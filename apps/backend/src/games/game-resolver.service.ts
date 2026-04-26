import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CacheService } from '../core/cache/cache.service';
import { GamesService, ResolvedGame } from './games.service';
import { IgdbService } from '../igdb/igdb.service';
import {
  DiscordAppData,
  DiscordAppService,
} from '../discord/discord-app.service';

// Discord application type 1 is "bot". We treat bot lookups as "no useful
// Discord data" — fall through to the existing IGDB cascade rather than
// trying to import a bot as a game. (Discord game apps are type 5, but the
// resolver doesn't depend on that — it only checks for the IGDB SKU.)
const DISCORD_APP_TYPE_BOT = 1;

@Injectable()
export class GameResolverService {
  // In-flight deduplication: when many concurrent callers try to resolve the
  // same game before the cascade has populated cache, they all share one
  // Promise instead of fanning out to the DB / IGDB. Closes the "500 users
  // launch GTA VI at midnight" thundering-herd problem (#79).
  private readonly inFlightResolutions = new Map<
    string,
    Promise<ResolvedGame>
  >();

  constructor(
    private games: GamesService,
    private igdb: IgdbService,
    private cache: CacheService,
    private discordApp: DiscordAppService,
    @InjectPinoLogger(GameResolverService.name) private logger: PinoLogger,
  ) {}

  async resolve(
    gameName: string,
    applicationId?: string,
  ): Promise<ResolvedGame> {
    const normalizedName = this.normalize(gameName);

    // Sync-fast path: cache hits return before we hit any coalescing machinery.
    // Tier 0 / Tier 1 in the original cascade.
    const cacheHit = this.tryCacheHit(normalizedName, applicationId);
    if (cacheHit) {
      this.logger.debug(
        { gameName, hitBy: applicationId ? 'applicationId' : 'name' },
        'Game resolved from cache',
      );
      if (applicationId) await this.linkApplicationId(cacheHit, applicationId);
      return cacheHit;
    }

    // Coalesce the expensive path (DB + IGDB) by the most specific key
    // available. applicationId is unambiguous when present; otherwise we
    // coalesce by normalized name.
    const coalesceKey = applicationId
      ? `appid:${applicationId}`
      : `name:${normalizedName}`;

    const existing = this.inFlightResolutions.get(coalesceKey);
    if (existing) {
      this.logger.debug(
        { gameName, coalesceKey },
        'Resolve coalesced to in-flight request',
      );
      const resolved = await existing;
      // If the in-flight request started WITHOUT our applicationId, link
      // ours now that the canonical row is known.
      if (applicationId) await this.linkApplicationId(resolved, applicationId);
      return resolved;
    }

    const promise = this.resolveFromMiss(
      gameName,
      normalizedName,
      applicationId,
    ).finally(() => {
      this.inFlightResolutions.delete(coalesceKey);
    });

    this.inFlightResolutions.set(coalesceKey, promise);
    return promise;
  }

  /**
   * Cheap synchronous cache lookup. Returns a cached row if either the
   * applicationId-keyed or the normalized-name-keyed entry is present.
   */
  private tryCacheHit(
    normalizedName: string,
    applicationId?: string,
  ): ResolvedGame | undefined {
    if (applicationId) {
      const byAppId = this.cache.get<ResolvedGame>(
        'game-resolve',
        `appid:${applicationId}`,
      );
      if (byAppId) return byAppId;
    }
    return this.cache.get<ResolvedGame>('game-resolve', normalizedName);
  }

  /**
   * The original cascade minus the sync cache hits, which are already
   * handled by [tryCacheHit] before coalescing.
   *
   * Cascade order: applicationId DB → Discord lookup → exact DB → fuzzy DB
   * → IGDB → minimal.
   */
  private async resolveFromMiss(
    gameName: string,
    normalizedName: string,
    applicationId?: string,
  ): Promise<ResolvedGame> {
    // Tier 0 (DB half): try the applicationId fast path in the DB.
    if (applicationId) {
      const byAppId = await this.games.findByApplicationId(applicationId);
      if (byAppId) {
        this.logger.info(
          { gameName, applicationId, gameId: byAppId.id },
          'Game resolved via applicationId',
        );
        this.cache.set('game-resolve', `appid:${applicationId}`, byAppId);
        this.cache.set('game-resolve', normalizedName, byAppId);
        return byAppId;
      }
    }

    // Tier 0c: Ask Discord about the application id. Discord curates a
    // mapping from each app id to the game's IGDB id (third_party_skus
    // distributor=igdb), which lets us skip fuzzy IGDB name search entirely
    // when Discord knows the game. Eliminates #153-class mismatches for
    // any game Discord has cataloged.
    let discordData: DiscordAppData | null = null;
    let searchName = gameName;
    let searchNormalizedName = normalizedName;
    if (applicationId) {
      discordData = await this.discordApp.fetchAppData(applicationId);

      // Bots fall through to the existing cascade — same as no Discord data.
      // Their `name` and SKUs aren't game metadata, so we ignore the lookup.
      if (discordData && discordData.type === DISCORD_APP_TYPE_BOT) {
        this.logger.debug(
          { gameName, applicationId, type: discordData.type },
          'Discord app is a bot — falling through',
        );
        discordData = null;
      }

      if (discordData) {
        if (discordData.igdb_id != null) {
          // Authoritative path: Discord told us the game's IGDB id directly.
          // Import by exact id — no name-based search, no chance of mismatch.
          try {
            const imported = await this.igdb.importById(discordData.igdb_id);
            if (imported) {
              await this.games.applyDiscordData(imported.id, discordData);
              if (applicationId) {
                await this.linkApplicationId(imported, applicationId);
              }
              this.logger.info(
                {
                  gameName,
                  applicationId,
                  gameId: imported.id,
                  igdbId: discordData.igdb_id,
                  discordName: discordData.name,
                },
                'Game resolved via Discord → IGDB id (authoritative)',
              );
              return this.cacheAndReturn(
                normalizedName,
                imported,
                applicationId,
              );
            }
          } catch (err) {
            // IGDB import failure here is unusual but not fatal — fall
            // through with Discord's name overriding the presence string,
            // so the rest of the cascade has a better query.
            this.logger.warn(
              { err, gameName, applicationId, igdbId: discordData.igdb_id },
              'Discord-mapped IGDB import failed — falling through with Discord name',
            );
          }
        }

        // No IGDB SKU (or import failed) but we still have Discord's
        // canonical name. Use it for the downstream DB / IGDB-search tiers
        // — it's more reliable than the raw presence string.
        if (discordData.name) {
          searchName = discordData.name;
          searchNormalizedName = this.normalize(discordData.name);
        }
      }
    }

    // Tier 2: Exact DB match (case-insensitive)
    const exact = await this.games.findExact(searchNormalizedName);
    if (exact) {
      this.logger.debug(
        { gameName, gameId: exact.id },
        'Game resolved via exact DB match',
      );
      if (applicationId) await this.linkApplicationId(exact, applicationId);
      await this.persistDiscordOrPresence(exact.id, discordData, gameName);
      return this.cacheAndReturn(normalizedName, exact, applicationId);
    }

    // Tier 3: Fuzzy DB match (pg_trgm)
    const fuzzy = await this.games.findFuzzy(searchNormalizedName);
    if (fuzzy) {
      this.logger.debug(
        { gameName, gameId: fuzzy.id },
        'Game resolved via fuzzy DB match',
      );
      if (applicationId) await this.linkApplicationId(fuzzy, applicationId);
      await this.persistDiscordOrPresence(fuzzy.id, discordData, gameName);
      return this.cacheAndReturn(normalizedName, fuzzy, applicationId);
    }

    // Tier 4: IGDB search + import
    try {
      const igdbResult = await this.igdb.searchAndImport(searchName);
      if (igdbResult) {
        this.logger.info(
          { gameName, gameId: igdbResult.id },
          'Game resolved via IGDB',
        );
        if (applicationId) await this.linkApplicationId(igdbResult, applicationId);
        await this.persistDiscordOrPresence(igdbResult.id, discordData, gameName);
        return this.cacheAndReturn(normalizedName, igdbResult, applicationId);
      }
    } catch (err) {
      this.logger.warn(
        { err, gameName },
        'IGDB search failed, falling back to minimal',
      );
    }

    // Tier 5: Minimal fallback
    const fallback = await this.games.createMinimal(gameName);
    this.logger.info(
      { gameName, gameId: fallback.id },
      'Game resolved via minimal fallback',
    );
    if (applicationId) await this.linkApplicationId(fallback, applicationId);
    await this.persistDiscordOrPresence(fallback.id, discordData, gameName);
    return this.cacheAndReturn(normalizedName, fallback, applicationId);
  }

  /**
   * Persist Discord-side metadata onto the resolved row. Prefers full RPC
   * data when available; otherwise falls back to capturing the original
   * presence string as `discord_name` so admins can see "Discord said X →
   * matched to Y" even when we never reached the RPC endpoint. Closes #114.
   */
  private async persistDiscordOrPresence(
    gameId: string,
    discordData: DiscordAppData | null,
    presenceName: string,
  ): Promise<void> {
    if (discordData) {
      await this.games.applyDiscordData(gameId, discordData);
    } else {
      await this.games.setDiscordNameIfMissing(gameId, presenceName);
    }
  }

  /**
   * Save discord applicationId on the resolved game and cache under the appid key.
   */
  private async linkApplicationId(
    game: ResolvedGame,
    applicationId: string,
  ): Promise<void> {
    if (game.id) {
      await this.games.setApplicationId(game.id, applicationId);
      this.cache.set('game-resolve', `appid:${applicationId}`, game);
    }
  }

  private normalize(name: string): string {
    return name
      .toLowerCase()
      .replace(/[™®©]/g, '')
      .trim();
  }

  private cacheAndReturn(
    key: string,
    game: ResolvedGame,
    applicationId?: string,
  ): ResolvedGame {
    this.cache.set('game-resolve', key, game);
    if (applicationId) {
      this.cache.set('game-resolve', `appid:${applicationId}`, game);
    }
    return game;
  }
}
