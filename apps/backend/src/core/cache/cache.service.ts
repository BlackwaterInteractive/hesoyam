import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

interface CacheOptions {
  max: number;
  ttlMs: number;
  allowStale?: boolean;
}

interface GetOptions {
  allowStale?: boolean;
}

@Injectable()
export class CacheService implements OnModuleInit {
  private caches = new Map<string, LRUCache<string, object>>();

  constructor(
    private config: ConfigService,
    @InjectPinoLogger(CacheService.name) private logger: PinoLogger,
  ) {}

  onModuleInit() {
    this.createCache('game-resolve', {
      max: this.config.get<number>('GAME_CACHE_MAX', 2000),
      ttlMs: this.config.get<number>('GAME_CACHE_TTL_MS', 3600000),
    });

    this.createCache('user-discord', {
      max: 10000,
      ttlMs: 5 * 60 * 1000,
    });

    this.createCache('twitch-token', {
      max: 1,
      ttlMs: 0, // managed manually by TwitchAuthService
    });

    // `allowStale: true` retains expired entries for explicit
    // `{ allowStale: true }` reads — used by IgdbService as a 429 fallback.
    // 24h TTL: IGDB catalog metadata is effectively immutable (cover art,
    // release year, developer don't change post-release). Empty results
    // get a shorter per-entry TTL applied in IgdbService so newly-released
    // games surface within minutes instead of a day.
    this.createCache('igdb-search', {
      max: this.config.get<number>('IGDB_SEARCH_CACHE_MAX', 500),
      ttlMs: this.config.get<number>(
        'IGDB_SEARCH_CACHE_TTL_MS',
        24 * 60 * 60 * 1000,
      ),
      allowStale: true,
    });

    // Steam SKU → IGDB game id resolution via /external_games. The mapping is
    // very stable (years), so a 24h TTL is conservative; allowStale + 429
    // fallback mirrors the igdb-search bucket so a rate-limit blip doesn't
    // surface as missing data.
    this.createCache('igdb-external-games', {
      max: this.config.get<number>('IGDB_EXTERNAL_GAMES_CACHE_MAX', 500),
      ttlMs: this.config.get<number>(
        'IGDB_EXTERNAL_GAMES_CACHE_TTL_MS',
        24 * 60 * 60 * 1000,
      ),
      allowStale: true,
    });

    this.logger.info('Cache service initialized');
  }

  createCache(name: string, options: CacheOptions): void {
    const allowStale = options.allowStale ?? false;
    this.caches.set(
      name,
      new LRUCache({
        max: options.max,
        ttl: options.ttlMs || undefined,
        allowStale,
        // Pair with `allowStale` so expired entries remain in memory for
        // explicit `{ allowStale: true }` reads (e.g. IGDB 429 fallback),
        // rather than being deleted on the first miss.
        noDeleteOnStaleGet: allowStale,
      }),
    );
  }

  get<T>(cacheName: string, key: string, options?: GetOptions): T | undefined {
    const cache = this.caches.get(cacheName);
    if (!cache) return undefined;
    // Default to `allowStale: false` so routine reads treat expired entries
    // as misses. Callers pass `{ allowStale: true }` explicitly to opt in.
    return cache.get(key, { allowStale: false, ...options }) as T | undefined;
  }

  set<T extends object>(cacheName: string, key: string, value: T, ttlMs?: number): void {
    const cache = this.caches.get(cacheName);
    if (!cache) return;
    cache.set(key, value as object, ttlMs ? { ttl: ttlMs } : undefined);
  }

  delete(cacheName: string, key: string): void {
    this.caches.get(cacheName)?.delete(key);
  }

  clear(cacheName: string): void {
    this.caches.get(cacheName)?.clear();
  }
}
