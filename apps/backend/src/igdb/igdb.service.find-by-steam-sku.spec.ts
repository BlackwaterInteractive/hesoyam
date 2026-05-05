import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getLoggerToken } from 'nestjs-pino';
import { Observable, of, throwError } from 'rxjs';
import { IgdbService } from './igdb.service';
import { TwitchAuthService } from './twitch-auth.service';
import { CacheService } from '../core/cache/cache.service';
import { SupabaseService } from '../core/supabase/supabase.service';

/**
 * Covers IgdbService.findBySteamSku — the Tier-B exact-match path used by
 * the bulk-seed pipeline when Discord's per-app RPC has a Steam SKU but no
 * IGDB SKU. Two HTTP calls are involved per resolution: /external_games
 * (Steam→IGDB id) followed by /games (full metadata via fetchGameData).
 */
describe('IgdbService.findBySteamSku', () => {
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

    await moduleRef.init();
    return moduleRef.get(IgdbService);
  };

  // Minimal IGDB /games payload — sufficient for fetchGameData's transform
  // path to run end-to-end without touching unrelated optional fields.
  const igdbGamesRow = (id: number, name: string) => ({
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    cover: null,
    genres: [],
    involved_companies: [],
    first_release_date: null,
    summary: null,
    screenshots: [],
    artworks: [],
    total_rating: null,
    total_rating_count: null,
    platforms: [],
  });

  beforeEach(async () => {
    service = await createService();
  });

  it('hit: external_games returns 1 row → fetchGameData called → returns IgdbGameData', async () => {
    httpPost
      .mockReturnValueOnce(of({ data: [{ game: 1877 }] }))
      .mockReturnValueOnce(of({ data: [igdbGamesRow(1877, 'Cyberpunk 2077')] }));

    const result = await service.findBySteamSku('1091500');

    expect(httpPost).toHaveBeenCalledTimes(2);
    expect(result?.igdb_id).toBe(1877);
    expect(result?.name).toBe('Cyberpunk 2077');

    // Verify the external_games request used the Steam category + correct uid.
    const externalArgs = httpPost.mock.calls[0];
    expect(externalArgs[0]).toMatch(/external_games$/);
    expect(externalArgs[1]).toContain('category = 1');
    expect(externalArgs[1]).toContain('uid = "1091500"');
  });

  it('miss: external_games empty → returns null and caches the negative', async () => {
    httpPost.mockReturnValueOnce(of({ data: [] }));

    const result = await service.findBySteamSku('999999');
    expect(result).toBeNull();
    expect(httpPost).toHaveBeenCalledTimes(1);

    // Second call hits the negative cache; no further IGDB calls.
    const result2 = await service.findBySteamSku('999999');
    expect(result2).toBeNull();
    expect(httpPost).toHaveBeenCalledTimes(1);
  });

  it('caches positive results — second call returns cached without re-hitting IGDB', async () => {
    httpPost
      .mockReturnValueOnce(of({ data: [{ game: 1877 }] }))
      .mockReturnValueOnce(of({ data: [igdbGamesRow(1877, 'Cyberpunk 2077')] }));

    await service.findBySteamSku('1091500');
    const second = await service.findBySteamSku('1091500');

    expect(httpPost).toHaveBeenCalledTimes(2); // not 4 — second call hit cache
    expect(second?.igdb_id).toBe(1877);
  });

  it('coalesces 10 concurrent cold-cache calls into one /external_games + one /games', async () => {
    // Slow /external_games response so all 10 callers line up against the
    // same in-flight promise. /games resolves synchronously after.
    httpPost
      .mockReturnValueOnce(
        new Observable<{ data: Array<{ game: number }> }>((sub) => {
          setTimeout(() => {
            sub.next({ data: [{ game: 1877 }] });
            sub.complete();
          }, 50);
        }),
      )
      .mockReturnValueOnce(
        of({ data: [igdbGamesRow(1877, 'Cyberpunk 2077')] }),
      );

    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.findBySteamSku('1091500')),
    );

    expect(httpPost).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(10);
    results.forEach((r) => expect(r?.igdb_id).toBe(1877));
  });

  it('different Steam SKUs produce different cache entries', async () => {
    httpPost
      .mockReturnValueOnce(of({ data: [{ game: 1877 }] }))
      .mockReturnValueOnce(of({ data: [igdbGamesRow(1877, 'Cyberpunk 2077')] }))
      .mockReturnValueOnce(of({ data: [{ game: 11133 }] }))
      .mockReturnValueOnce(of({ data: [igdbGamesRow(11133, 'Dark Souls III')] }));

    const a = await service.findBySteamSku('1091500');
    const b = await service.findBySteamSku('374320');

    expect(httpPost).toHaveBeenCalledTimes(4);
    expect(a?.igdb_id).toBe(1877);
    expect(b?.igdb_id).toBe(11133);
  });

  it('on HTTP 429 with no prior cache, returns null (does not throw)', async () => {
    httpPost.mockReturnValueOnce(
      throwError(() => ({
        response: { status: 429, statusText: 'Too Many Requests' },
      })),
    );

    const result = await service.findBySteamSku('1091500');
    expect(result).toBeNull();
  });

  it('on HTTP 429 with stale-but-retained cache, returns the stale value', async () => {
    // Short TTL so we can age the entry out in-process.
    service = await createService({ IGDB_EXTERNAL_GAMES_CACHE_TTL_MS: 100 });

    httpPost
      .mockReturnValueOnce(of({ data: [{ game: 1877 }] }))
      .mockReturnValueOnce(of({ data: [igdbGamesRow(1877, 'Cyberpunk 2077')] }));
    const first = await service.findBySteamSku('1091500');
    expect(first?.igdb_id).toBe(1877);

    await new Promise((r) => setTimeout(r, 150));

    httpPost.mockReturnValueOnce(
      throwError(() => ({ response: { status: 429 } })),
    );
    const second = await service.findBySteamSku('1091500');

    expect(second?.igdb_id).toBe(1877); // served from stale cache
    expect(httpPost).toHaveBeenCalledTimes(3); // 2 initial + 1 retry attempt
  });

  it('non-429 errors propagate to the caller', async () => {
    httpPost.mockReturnValueOnce(
      throwError(() => ({ response: { status: 500 } })),
    );

    await expect(service.findBySteamSku('1091500')).rejects.toMatchObject({
      response: { status: 500 },
    });
  });
});
