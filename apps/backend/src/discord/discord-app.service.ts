import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CacheService } from '../core/cache/cache.service';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const CACHE_NAME = 'discord-app';

/**
 * Parsed shape of `GET /applications/{id}/rpc` after we extract the bits we
 * care about. The raw Discord response has many more fields (verify_key,
 * install_params, integration_types_config, etc.) we don't need.
 *
 * `igdb_id`, `steam_app_id`, etc. come from the response's `third_party_skus`
 * array — Discord curates a mapping from each app id to the game's SKU on
 * various storefronts, including IGDB.
 */
export interface DiscordAppData {
  id: string;
  name: string;
  description: string | null;
  // Discord application type: 5=Distribution (modern game), 1=Game (legacy),
  // 4=Music, null=generic application/bot. We do not branch on it — the
  // resolver federates by id and consults `igdb_id` / `linked_app_ids`
  // instead. Surfaced here for diagnostics only.
  type: number;
  icon: string | null;
  cover_image: string | null;
  aliases: string[];
  // Other Discord application IDs the response advertises as linked to this
  // one — typically the game's launcher, regional variant, or demo (Discord
  // RPC `linked_games[].id`). Seeded into `game_discord_applications` so
  // future presence events for those ids resolve to the same canonical game
  // without a second admin action. May be empty.
  linked_app_ids: string[];
  igdb_id: number | null;
  steam_app_id: string | null;
  gog_id: string | null;
  epic_id: string | null;
  xbox_app_id: string | null;
  opencritic_id: string | null;
}

interface DiscordRpcResponse {
  id: string;
  name: string;
  description?: string | null;
  type?: number;
  icon?: string | null;
  cover_image?: string | null;
  aliases?: string[];
  third_party_skus?: { id: string; sku?: string; distributor: string }[];
  linked_games?: { id: string; type?: number }[];
}

/**
 * Cache envelope so we can distinguish "not in cache" (undefined) from
 * "cached as not-found" ({ data: null }). The underlying CacheService is
 * typed `T extends object`, so we can't store a bare null — wrap it.
 */
interface CachedDiscordApp {
  data: DiscordAppData | null;
}

/**
 * Looks up Discord application metadata via the public RPC endpoint.
 *
 * - **Endpoint:** `GET https://discord.com/api/v10/applications/{id}/rpc`
 * - **Auth:** none. Public endpoint.
 * - **Cache:** 24h TTL. App metadata is essentially immutable; new SKU
 *   mappings appear at storefront-launch cadence (rare).
 * - **In-flight dedup:** concurrent callers asking about the same app id
 *   share a single HTTP round-trip (mirrors {@link IgdbService.search}).
 *
 * Returns `null` when:
 *   - the app id is unknown to Discord (HTTP 404)
 *   - the network call fails (timeout, 5xx)
 *
 * Callers should treat `null` as "no Discord data; fall through to the
 * existing resolver cascade".
 */
@Injectable()
export class DiscordAppService implements OnModuleInit {
  private inFlight = new Map<string, Promise<DiscordAppData | null>>();

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private cache: CacheService,
    @InjectPinoLogger(DiscordAppService.name) private logger: PinoLogger,
  ) {}

  onModuleInit() {
    // Register the cache bucket. CacheService.createCache is idempotent on
    // bucket name, so there's no harm if it's already been created (the
    // global registration in CacheService.onModuleInit doesn't include this
    // bucket — keeping it scoped here so test setups don't need to know
    // about it).
    this.cache.createCache(CACHE_NAME, {
      max: this.config.get<number>('DISCORD_APP_CACHE_MAX', 2000),
      ttlMs: this.config.get<number>(
        'DISCORD_APP_CACHE_TTL_MS',
        24 * 60 * 60 * 1000,
      ),
    });
  }

  /**
   * Fetch and parse Discord app metadata for `applicationId`. Idempotent and
   * cache-friendly — call it whenever a Discord presence event names an app
   * id we haven't seen recently.
   */
  async fetchAppData(applicationId: string): Promise<DiscordAppData | null> {
    const cached = this.cache.get<CachedDiscordApp>(
      CACHE_NAME,
      applicationId,
    );
    if (cached !== undefined) {
      this.logger.debug({ applicationId }, 'Discord app cache hit');
      return cached.data;
    }

    const inFlight = this.inFlight.get(applicationId);
    if (inFlight) {
      this.logger.debug(
        { applicationId },
        'Discord app coalesced to in-flight request',
      );
      return inFlight;
    }

    const promise = this.fetchAndCache(applicationId).finally(() => {
      this.inFlight.delete(applicationId);
    });
    this.inFlight.set(applicationId, promise);
    return promise;
  }

  private async fetchAndCache(
    applicationId: string,
  ): Promise<DiscordAppData | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<DiscordRpcResponse>(
          `${DISCORD_API_BASE}/applications/${encodeURIComponent(
            applicationId,
          )}/rpc`,
          { timeout: 5000 },
        ),
      );

      const parsed = this.parse(response.data);
      this.cache.set<CachedDiscordApp>(CACHE_NAME, applicationId, {
        data: parsed,
      });
      this.logger.info(
        {
          applicationId,
          name: parsed.name,
          type: parsed.type,
          igdb_id: parsed.igdb_id,
        },
        'Discord app fetched',
      );
      return parsed;
    } catch (err) {
      if (this.isNotFound(err)) {
        // Negative cache: a 404 stays in cache so we don't hammer Discord
        // for unknown ids. Shorter TTL than the success path so newly-
        // registered apps surface within an hour.
        this.cache.set<CachedDiscordApp>(
          CACHE_NAME,
          applicationId,
          { data: null },
          this.config.get<number>(
            'DISCORD_APP_NOT_FOUND_TTL_MS',
            60 * 60 * 1000,
          ),
        );
        this.logger.debug(
          { applicationId },
          'Discord app 404 — cached as null',
        );
        return null;
      }
      // Transient error: don't cache, let the next call retry.
      this.logger.warn(
        { err, applicationId },
        'Discord app fetch failed — falling through (no cache)',
      );
      return null;
    }
  }

  /**
   * Pulls the fields we care about out of the raw RPC response and extracts
   * known distributor SKUs into typed columns. Anything else in the response
   * is dropped — re-fetchable from Discord if ever needed.
   */
  private parse(raw: DiscordRpcResponse): DiscordAppData {
    const skus = raw.third_party_skus ?? [];
    const findSku = (distributor: string): string | null => {
      const match = skus.find((s) => s.distributor === distributor);
      return match?.id ?? null;
    };

    const igdbSku = findSku('igdb');
    const igdb_id = igdbSku ? this.toIntOrNull(igdbSku) : null;

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? null,
      type: raw.type ?? 0,
      icon: raw.icon ?? null,
      cover_image: raw.cover_image ?? null,
      aliases: raw.aliases ?? [],
      linked_app_ids: (raw.linked_games ?? []).map((g) => g.id),
      igdb_id,
      steam_app_id: findSku('steam'),
      gog_id: findSku('gop'),
      epic_id: findSku('epic'),
      xbox_app_id: findSku('xbox'),
      opencritic_id: findSku('opencritic'),
    };
  }

  private toIntOrNull(s: string): number | null {
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }

  private isNotFound(err: unknown): boolean {
    if (err instanceof AxiosError) {
      return err.response?.status === 404;
    }
    const shaped = err as { response?: { status?: number }; status?: number };
    return shaped?.response?.status === 404 || shaped?.status === 404;
  }
}
