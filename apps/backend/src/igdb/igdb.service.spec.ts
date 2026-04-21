import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getLoggerToken } from 'nestjs-pino';
import { Observable, of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { IgdbService } from './igdb.service';
import { TwitchAuthService } from './twitch-auth.service';
import { CacheService } from '../core/cache/cache.service';
import { SupabaseService } from '../core/supabase/supabase.service';

/**
 * Covers the cache + in-flight dedup + 429 handling added in issue #129.
 * All tests use the real CacheService — we're verifying the integration,
 * not a cache abstraction.
 */
describe('IgdbService.search', () => {
  let service: IgdbService;
  let httpPost: jest.Mock;

  const noopLogger = () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  });

  const createService = async (
    configOverrides: Record<string, unknown> = {},
  ): Promise<IgdbService> => {
    httpPost = jest.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        IgdbService,
        CacheService,
        { provide: HttpService, useValue: { post: httpPost } },
        {
          provide: TwitchAuthService,
          useValue: {
            getAccessToken: jest.fn().mockResolvedValue('fake-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (k: string) =>
              (configOverrides[k] as string | undefined) ?? 'fake-client-id',
            get: <T>(k: string, d: T): T =>
              configOverrides[k] !== undefined
                ? (configOverrides[k] as T)
                : d,
          },
        },
        { provide: SupabaseService, useValue: {} },
        { provide: getLoggerToken(IgdbService.name), useValue: noopLogger() },
        { provide: getLoggerToken(CacheService.name), useValue: noopLogger() },
      ],
    }).compile();

    await moduleRef.init(); // triggers CacheService.onModuleInit → registers igdb-search bucket
    return moduleRef.get(IgdbService);
  };

  beforeEach(async () => {
    service = await createService();
  });

  it('first call misses cache, hits IGDB, returns data', async () => {
    httpPost.mockReturnValue(of({ data: [{ id: 1, name: 'RDR2' }] }));
    const result = await service.search('rdr2');
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 1, name: 'RDR2' }]);
  });

  it('second identical call hits cache; IGDB is called exactly once', async () => {
    httpPost.mockReturnValue(of({ data: [{ id: 1 }] }));
    await service.search('rdr2');
    await service.search('rdr2');
    expect(httpPost).toHaveBeenCalledTimes(1);
  });

  it('normalises query — different casing / whitespace / symbols share cache key', async () => {
    httpPost.mockReturnValue(of({ data: [{ id: 1 }] }));
    await service.search('RDR2™');
    await service.search('  rdr2  ');
    await service.search('rdr2©');
    expect(httpPost).toHaveBeenCalledTimes(1);
  });

  it('different `limit` values produce different cache entries', async () => {
    httpPost.mockReturnValue(of({ data: [] }));
    await service.search('rdr2', 5);
    await service.search('rdr2', 10);
    expect(httpPost).toHaveBeenCalledTimes(2);
  });

  it('coalesces 10 concurrent cold-cache calls into 1 IGDB call', async () => {
    // Simulate a 50ms IGDB round-trip so all 10 calls line up against one in-flight request.
    httpPost.mockReturnValue(
      new Observable<{ data: Array<{ id: number }> }>((sub) => {
        setTimeout(() => {
          sub.next({ data: [{ id: 1 }] });
          sub.complete();
        }, 50);
      }),
    );

    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.search('elden ring')),
    );

    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(10);
    results.forEach((r) => expect(r).toEqual([{ id: 1 }]));
  });

  it('on HTTP 429 with no prior cache, returns [] (does not throw)', async () => {
    httpPost.mockReturnValue(
      throwError(() => ({
        response: { status: 429, statusText: 'Too Many Requests' },
      })),
    );
    const result = await service.search('rdr2');
    expect(result).toEqual([]);
  });

  it('detects 429 on a real AxiosError instance (first branch of isRateLimitError)', async () => {
    const axiosErr = new AxiosError(
      'Rate limited',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 429,
        statusText: 'Too Many Requests',
        data: {},
        headers: {},
        config: {} as never,
      } as never,
    );
    httpPost.mockReturnValue(throwError(() => axiosErr));
    const result = await service.search('rdr2');
    expect(result).toEqual([]);
  });

  it('on HTTP 429 with expired-but-retained cache, returns the stale value', async () => {
    // Rebuild with a 100ms TTL so we can age the cache out in-process.
    service = await createService({ IGDB_SEARCH_CACHE_TTL_MS: 100 });

    httpPost.mockReturnValueOnce(of({ data: [{ id: 1, name: 'RDR2' }] }));
    const first = await service.search('rdr2');
    expect(first).toEqual([{ id: 1, name: 'RDR2' }]);

    // Wait past the 100ms TTL; the entry is expired but retained (allowStale: true).
    await new Promise((r) => setTimeout(r, 150));

    httpPost.mockReturnValueOnce(
      throwError(() => ({ response: { status: 429 } })),
    );
    const second = await service.search('rdr2');

    expect(second).toEqual([{ id: 1, name: 'RDR2' }]);
    expect(httpPost).toHaveBeenCalledTimes(2); // cache miss after TTL → new IGDB attempt
  });

  it('non-429 errors propagate to the caller', async () => {
    httpPost.mockReturnValue(
      throwError(() => ({ response: { status: 500 } })),
    );
    await expect(service.search('rdr2')).rejects.toMatchObject({
      response: { status: 500 },
    });
  });

  it('caches empty results with a short TTL so newly-added games can surface', async () => {
    // 50ms empty TTL, leave the main TTL at its default so only the
    // negative-cache path expires during this test.
    service = await createService({ IGDB_SEARCH_EMPTY_TTL_MS: 50 });

    httpPost.mockReturnValueOnce(of({ data: [] }));
    const first = await service.search('pentiment');
    expect(first).toEqual([]);
    expect(httpPost).toHaveBeenCalledTimes(1);

    // Wait past the 50ms empty-entry TTL.
    await new Promise((r) => setTimeout(r, 100));

    // IGDB now has the game; the expired-empty entry must not block a re-fetch.
    httpPost.mockReturnValueOnce(of({ data: [{ id: 1, name: 'Pentiment' }] }));
    const second = await service.search('pentiment');
    expect(second).toEqual([{ id: 1, name: 'Pentiment' }]);
    expect(httpPost).toHaveBeenCalledTimes(2);
  });
});
