import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

interface CacheOptions {
  max: number;
  ttlMs: number;
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

    this.logger.info('Cache service initialized');
  }

  createCache(name: string, options: CacheOptions): void {
    this.caches.set(
      name,
      new LRUCache({
        max: options.max,
        ttl: options.ttlMs || undefined,
      }),
    );
  }

  get<T>(cacheName: string, key: string): T | undefined {
    const cache = this.caches.get(cacheName);
    if (!cache) return undefined;
    return cache.get(key) as T | undefined;
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
