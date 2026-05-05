import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TwitchAuthService } from './twitch-auth.service';
import { SupabaseService } from '../core/supabase/supabase.service';
import { CacheService } from '../core/cache/cache.service';
import { ResolvedGame } from '../games/games.service';

const IGDB_BASE_URL = 'https://api.igdb.com/v4';
const SEARCH_CACHE = 'igdb-search';
const EXTERNAL_GAMES_CACHE = 'igdb-external-games';

// IGDB external_games category enum — only the value we use here.
// See https://api-docs.igdb.com/#external-game-enums.
const EXTERNAL_GAME_CATEGORY_STEAM = 1;

interface IgdbExternalGameRow {
  game: number; // canonical IGDB game id
}

// Wrapper so we can distinguish "not in cache" (undefined) from "cached as
// known-not-found" ({ data: null }) — CacheService.set is typed
// `T extends object`, so a bare null can't be stored.
interface CachedExternalGame {
  data: IgdbGameData | null;
}

/**
 * IGDB metadata in the exact shape we write to the `games` table (and the
 * exact shape the `reconcile_orphan_game` SQL function accepts as JSONB).
 */
export interface IgdbGameData {
  igdb_id: number;
  name: string;
  slug: string;
  cover_url: string | null;
  genres: string[];
  developer: string | null;
  publisher: string | null;
  release_year: number | null;
  description: string | null;
  first_release_date: string | null;
  screenshots: string[];
  artwork_url: string | null;
  rating: number | null;
  rating_count: number | null;
  platforms: string[];
}

@Injectable()
export class IgdbService {
  // In-flight deduplication: concurrent callers with the same cache key
  // share one IGDB round-trip instead of fanning out.
  private inFlightSearches = new Map<string, Promise<unknown[]>>();
  private inFlightExternalGames = new Map<string, Promise<IgdbGameData | null>>();

  constructor(
    private twitchAuth: TwitchAuthService,
    private http: HttpService,
    private config: ConfigService,
    private supabase: SupabaseService,
    private cache: CacheService,
    @InjectPinoLogger(IgdbService.name) private logger: PinoLogger,
  ) {}

  async search(query: string, limit = 10): Promise<unknown[]> {
    const key = this.searchCacheKey(query, limit);

    // Fresh cache hit — no IGDB call, no DB, no wait.
    const cached = this.cache.get<unknown[]>(SEARCH_CACHE, key);
    if (cached) {
      this.logger.debug({ query, key }, 'IGDB search cache hit');
      return cached;
    }

    // Coalesce concurrent cache misses onto a single in-flight request.
    const inFlight = this.inFlightSearches.get(key);
    if (inFlight) {
      this.logger.debug({ query, key }, 'IGDB search coalesced to in-flight request');
      return inFlight;
    }

    const promise = this.fetchAndCacheSearch(query, limit, key).finally(() => {
      this.inFlightSearches.delete(key);
    });
    this.inFlightSearches.set(key, promise);
    return promise;
  }

  private async fetchAndCacheSearch(
    query: string,
    limit: number,
    key: string,
  ): Promise<unknown[]> {
    try {
      const token = await this.twitchAuth.getAccessToken();
      const clientId = this.config.getOrThrow<string>('TWITCH_CLIENT_ID');

      const response = await firstValueFrom(
        this.http.post(
          `${IGDB_BASE_URL}/games`,
          `search "${query}"; fields name,slug,cover.image_id,genres.name,first_release_date; limit ${limit};`,
          {
            headers: {
              'Client-ID': clientId,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'text/plain',
            },
          },
        ),
      );

      const data = (response.data ?? []) as unknown[];
      // Negative cache: empty results expire much faster than populated ones.
      // Prevents a "game released yesterday, still shows as missing today"
      // scenario where an empty cache entry from before the game was in
      // IGDB would otherwise persist for the full main TTL (24h default).
      const ttlMs =
        data.length === 0
          ? this.config.get<number>('IGDB_SEARCH_EMPTY_TTL_MS', 5 * 60 * 1000)
          : undefined;
      this.cache.set(SEARCH_CACHE, key, data, ttlMs);
      this.logger.debug(
        { query, key, count: data.length, ttlMs: ttlMs ?? 'default' },
        'IGDB search fetched and cached',
      );
      return data;
    } catch (err) {
      // Graceful 429: return stale cache if the entry is still retained,
      // otherwise an empty array. Never surfaces as "Search failed" to the user.
      if (this.isRateLimitError(err)) {
        const stale = this.cache.get<unknown[]>(SEARCH_CACHE, key, {
          allowStale: true,
        });
        this.logger.warn(
          { query, key, hasStale: Boolean(stale) },
          'IGDB rate limit (429) on search — serving stale cache or empty array',
        );
        return stale ?? [];
      }
      throw err;
    }
  }

  private searchCacheKey(query: string, limit: number): string {
    const normalized = query.toLowerCase().replace(/[™®©]/g, '').trim();
    return `${normalized}::${limit}`;
  }

  private isRateLimitError(err: unknown): boolean {
    if (err instanceof AxiosError) {
      return err.response?.status === 429;
    }
    const shaped = err as { response?: { status?: number }; status?: number };
    return shaped?.response?.status === 429 || shaped?.status === 429;
  }

  async searchAndImport(gameName: string): Promise<ResolvedGame | null> {
    const results = await this.search(gameName, 5);

    if (!results || results.length === 0) {
      return null;
    }

    // Find best match: exact name match first, then first result
    const exactMatch = results.find(
      (r: any) => r.name.toLowerCase() === gameName.toLowerCase(),
    );
    const bestMatch = exactMatch ?? results[0];

    return this.importById((bestMatch as { id: number }).id);
  }

  /**
   * Fetch + transform IGDB metadata for a given game id. Does NOT write to
   * the DB — callers do the persistence themselves. Used by both the
   * importById upsert path and the reconciliation worker, which needs the
   * raw metadata to pass as JSONB to the `reconcile_orphan_game` SQL
   * function.
   */
  async fetchGameData(igdbId: number): Promise<IgdbGameData> {
    const token = await this.twitchAuth.getAccessToken();
    const clientId = this.config.getOrThrow<string>('TWITCH_CLIENT_ID');

    const response = await firstValueFrom(
      this.http.post(
        `${IGDB_BASE_URL}/games`,
        `where id = ${igdbId}; fields name,slug,cover.image_id,genres.name,involved_companies.company.name,involved_companies.developer,first_release_date,summary,screenshots.image_id,artworks.image_id,total_rating,total_rating_count,platforms.name;`,
        {
          headers: {
            'Client-ID': clientId,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
        },
      ),
    );

    const game = response.data[0];
    if (!game) {
      throw new Error(`IGDB game not found: ${igdbId}`);
    }

    return {
      igdb_id: igdbId,
      name: game.name,
      slug: game.slug,
      cover_url: game.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
        : null,
      genres: game.genres?.map((g: any) => g.name) ?? [],
      developer:
        game.involved_companies?.find((c: any) => c.developer)?.company?.name ??
        null,
      publisher:
        game.involved_companies?.find((c: any) => !c.developer)?.company
          ?.name ?? null,
      release_year: game.first_release_date
        ? new Date(game.first_release_date * 1000).getFullYear()
        : null,
      description: game.summary ?? null,
      first_release_date: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString()
        : null,
      screenshots:
        game.screenshots?.map(
          (s: any) =>
            `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`,
        ) ?? [],
      artwork_url: game.artworks?.[0]?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.artworks[0].image_id}.jpg`
        : null,
      rating: game.total_rating ?? null,
      rating_count: game.total_rating_count ?? null,
      platforms: game.platforms?.map((p: any) => p.name) ?? [],
    };
  }

  /**
   * Resolve a Steam app id to its canonical IGDB game via IGDB's
   * `/external_games` endpoint, then return the full IgdbGameData.
   *
   * Used by the bulk-seed pipeline as a Tier-B exact-match path when
   * Discord's per-app RPC does NOT include an `igdb` SKU but DOES include
   * a `steam` SKU. Avoids the fuzzy name-search fallback for any game
   * that has a Steam page IGDB has cataloged. Returns null when:
   *   - The Steam app id is not in IGDB's external_games index.
   *   - The IGDB call rate-limits and there is no stale cache to fall back on.
   * Both cases are caller-recoverable — fall through to fuzzy search.
   *
   * Cache: per-Steam-SKU, 24h TTL, allowStale on 429 (mirrors search()).
   * In-flight dedup: concurrent callers for the same SKU share one IGDB
   * round-trip (which itself includes a downstream fetchGameData call).
   */
  async findBySteamSku(steamSku: string): Promise<IgdbGameData | null> {
    const key = steamSku;

    const cached = this.cache.get<CachedExternalGame>(
      EXTERNAL_GAMES_CACHE,
      key,
    );
    if (cached !== undefined) {
      this.logger.debug({ steamSku, key }, 'IGDB external_games cache hit');
      return cached.data;
    }

    const inFlight = this.inFlightExternalGames.get(key);
    if (inFlight) {
      this.logger.debug(
        { steamSku, key },
        'IGDB external_games coalesced to in-flight request',
      );
      return inFlight;
    }

    const promise = this.fetchAndCacheExternalGame(steamSku, key).finally(
      () => {
        this.inFlightExternalGames.delete(key);
      },
    );
    this.inFlightExternalGames.set(key, promise);
    return promise;
  }

  private async fetchAndCacheExternalGame(
    steamSku: string,
    key: string,
  ): Promise<IgdbGameData | null> {
    try {
      const token = await this.twitchAuth.getAccessToken();
      const clientId = this.config.getOrThrow<string>('TWITCH_CLIENT_ID');

      const response = await firstValueFrom(
        this.http.post<IgdbExternalGameRow[]>(
          `${IGDB_BASE_URL}/external_games`,
          `where category = ${EXTERNAL_GAME_CATEGORY_STEAM} & uid = "${steamSku}"; fields game; limit 1;`,
          {
            headers: {
              'Client-ID': clientId,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'text/plain',
            },
          },
        ),
      );

      const rows = response.data ?? [];
      if (rows.length === 0) {
        // Negative cache: shorter TTL than positive hits because IGDB may
        // index the SKU later (newly-released game, late curation).
        const ttlMs = this.config.get<number>(
          'IGDB_EXTERNAL_GAMES_NOT_FOUND_TTL_MS',
          60 * 60 * 1000,
        );
        this.cache.set<CachedExternalGame>(
          EXTERNAL_GAMES_CACHE,
          key,
          { data: null },
          ttlMs,
        );
        this.logger.debug(
          { steamSku, key },
          'IGDB external_games miss — cached as null',
        );
        return null;
      }

      const igdbId = rows[0].game;
      const data = await this.fetchGameData(igdbId);
      this.cache.set<CachedExternalGame>(EXTERNAL_GAMES_CACHE, key, { data });
      this.logger.debug(
        { steamSku, key, igdbId, name: data.name },
        'IGDB external_games hit and cached',
      );
      return data;
    } catch (err) {
      // 429 fallback mirrors search(): serve stale if retained, else null.
      // Lets the caller fall through to fuzzy search instead of error-failing.
      if (this.isRateLimitError(err)) {
        const stale = this.cache.get<CachedExternalGame>(
          EXTERNAL_GAMES_CACHE,
          key,
          { allowStale: true },
        );
        this.logger.warn(
          { steamSku, key, hasStale: Boolean(stale) },
          'IGDB rate limit (429) on external_games — serving stale cache or null',
        );
        return stale?.data ?? null;
      }
      throw err;
    }
  }

  async importById(igdbId: number): Promise<ResolvedGame> {
    const data = await this.fetchGameData(igdbId);

    const { data: upserted, error } = await this.supabase
      .getClient()
      .from('games')
      .upsert(data, { onConflict: 'igdb_id' })
      .select('id, name, slug, cover_url, igdb_id')
      .single();

    if (error) {
      this.logger.error({ error, igdbId }, 'Failed to upsert IGDB game');
      throw error;
    }

    this.logger.info(
      { igdbId, name: upserted.name, gameId: upserted.id },
      'Game imported from IGDB',
    );

    return upserted;
  }
}
