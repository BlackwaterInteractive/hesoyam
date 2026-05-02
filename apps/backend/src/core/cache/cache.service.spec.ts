import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getLoggerToken } from 'nestjs-pino';
import { CacheService } from './cache.service';

/**
 * Direct coverage for the LRU + TTL + allowStale wrapper. Until now this
 * service was only exercised transitively through IgdbService — see #130 for
 * the `allowStale` wiring bug that motivated pulling these tests out.
 */
describe('CacheService', () => {
  let service: CacheService;

  const noopLogger = () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  });

  const buildService = async (
    configOverrides: Record<string, unknown> = {},
  ): Promise<CacheService> => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: <T>(k: string, d: T): T =>
              configOverrides[k] !== undefined
                ? (configOverrides[k] as T)
                : d,
            getOrThrow: (k: string) => configOverrides[k] ?? 'fake',
          },
        },
        { provide: getLoggerToken(CacheService.name), useValue: noopLogger() },
      ],
    }).compile();

    await moduleRef.init();
    return moduleRef.get(CacheService);
  };

  beforeEach(async () => {
    service = await buildService();
  });

  describe('basic get / set / delete / clear', () => {
    it('round-trips a value through set → get', () => {
      service.createCache('test', { max: 10, ttlMs: 1000 });
      service.set('test', 'k', { v: 1 });
      expect(service.get('test', 'k')).toEqual({ v: 1 });
    });

    it('delete removes the entry', () => {
      service.createCache('test', { max: 10, ttlMs: 1000 });
      service.set('test', 'k', { v: 1 });
      service.delete('test', 'k');
      expect(service.get('test', 'k')).toBeUndefined();
    });

    it('clear empties the bucket', () => {
      service.createCache('test', { max: 10, ttlMs: 1000 });
      service.set('test', 'a', { v: 1 });
      service.set('test', 'b', { v: 2 });
      service.clear('test');
      expect(service.get('test', 'a')).toBeUndefined();
      expect(service.get('test', 'b')).toBeUndefined();
    });
  });

  describe('unknown buckets are no-ops, never throws', () => {
    it('get returns undefined', () => {
      expect(service.get('does-not-exist', 'k')).toBeUndefined();
    });

    it('set is silently dropped', () => {
      expect(() => service.set('does-not-exist', 'k', { v: 1 })).not.toThrow();
    });

    it('delete is silently dropped', () => {
      expect(() => service.delete('does-not-exist', 'k')).not.toThrow();
    });

    it('clear is silently dropped', () => {
      expect(() => service.clear('does-not-exist')).not.toThrow();
    });
  });

  describe('LRU eviction', () => {
    it('evicts the oldest entry when max is exceeded', () => {
      service.createCache('tiny', { max: 2, ttlMs: 60_000 });
      service.set('tiny', 'a', { v: 1 });
      service.set('tiny', 'b', { v: 2 });
      service.set('tiny', 'c', { v: 3 });

      expect(service.get('tiny', 'a')).toBeUndefined();
      expect(service.get('tiny', 'b')).toEqual({ v: 2 });
      expect(service.get('tiny', 'c')).toEqual({ v: 3 });
    });
  });

  describe('TTL expiry', () => {
    it('returns undefined after the bucket TTL elapses (allowStale: false)', async () => {
      service.createCache('short', { max: 10, ttlMs: 50 });
      service.set('short', 'k', { v: 1 });
      await new Promise((r) => setTimeout(r, 80));
      expect(service.get('short', 'k')).toBeUndefined();
    });

    it('per-entry ttlMs on set overrides the bucket default', async () => {
      service.createCache('long', { max: 10, ttlMs: 60_000 });
      service.set('long', 'k', { v: 1 }, 50);
      await new Promise((r) => setTimeout(r, 80));
      expect(service.get('long', 'k')).toBeUndefined();
    });
  });

  describe('allowStale + noDeleteOnStaleGet semantics', () => {
    it('default get treats expired entries as a miss even on a stale-enabled bucket', async () => {
      service.createCache('stale-ok', {
        max: 10,
        ttlMs: 50,
        allowStale: true,
      });
      service.set('stale-ok', 'k', { v: 1 });
      await new Promise((r) => setTimeout(r, 80));

      expect(service.get('stale-ok', 'k')).toBeUndefined();
    });

    it('explicit { allowStale: true } returns the retained expired value', async () => {
      service.createCache('stale-ok', {
        max: 10,
        ttlMs: 50,
        allowStale: true,
      });
      service.set('stale-ok', 'k', { v: 1 });
      await new Promise((r) => setTimeout(r, 80));

      expect(service.get('stale-ok', 'k', { allowStale: true })).toEqual({
        v: 1,
      });
    });

    it('non-stale bucket: stale-allowed get returns the value once, then deletes it', async () => {
      // Bucket without allowStale → noDeleteOnStaleGet is false, so the
      // entry is dropped the first time a stale read uncovers it.
      service.createCache('no-stale', { max: 10, ttlMs: 50 });
      service.set('no-stale', 'k', { v: 1 });
      await new Promise((r) => setTimeout(r, 80));

      expect(service.get('no-stale', 'k', { allowStale: true })).toEqual({
        v: 1,
      });
      expect(service.get('no-stale', 'k', { allowStale: true })).toBeUndefined();
    });

    it('stale-enabled bucket: stale-allowed get keeps the entry across multiple reads', async () => {
      // Pairs with noDeleteOnStaleGet: true. Without this, the LRU would
      // evict the entry on the first stale read, breaking the IGDB 429
      // fallback's "serve stale repeatedly while rate-limited" contract.
      service.createCache('persist-stale', {
        max: 10,
        ttlMs: 50,
        allowStale: true,
      });
      service.set('persist-stale', 'k', { v: 42 });
      await new Promise((r) => setTimeout(r, 80));

      expect(service.get('persist-stale', 'k', { allowStale: true })).toEqual({
        v: 42,
      });
      expect(service.get('persist-stale', 'k', { allowStale: true })).toEqual({
        v: 42,
      });
    });
  });

  describe('onModuleInit registers default buckets', () => {
    it.each(['game-resolve', 'user-discord', 'twitch-token', 'igdb-search'])(
      'registers the %s bucket as usable on boot',
      (name) => {
        service.set(name, 'probe', { v: 1 });
        expect(service.get(name, 'probe')).toEqual({ v: 1 });
      },
    );

    it('igdb-search bucket is registered with allowStale (IGDB 429 fallback)', async () => {
      service = await buildService({ IGDB_SEARCH_CACHE_TTL_MS: 50 });
      service.set('igdb-search', 'k', { v: 1 });
      await new Promise((r) => setTimeout(r, 80));

      expect(service.get('igdb-search', 'k', { allowStale: true })).toEqual({
        v: 1,
      });
    });
  });
});
