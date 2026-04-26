import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getLoggerToken } from 'nestjs-pino';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { DiscordAppService } from './discord-app.service';
import { CacheService } from '../core/cache/cache.service';

/**
 * Covers cache + in-flight dedup + parser + 404/error handling for the
 * Discord application lookup added in issue #160. Real CacheService
 * (we're testing the integration, not the abstraction).
 */
describe('DiscordAppService.fetchAppData', () => {
  let httpGet: jest.Mock;

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
  ): Promise<DiscordAppService> => {
    httpGet = jest.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordAppService,
        CacheService,
        { provide: HttpService, useValue: { get: httpGet } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (k: string) =>
              (configOverrides[k] as string | undefined) ?? '',
            get: <T>(k: string, d: T): T =>
              configOverrides[k] !== undefined
                ? (configOverrides[k] as T)
                : d,
          },
        },
        {
          provide: getLoggerToken(DiscordAppService.name),
          useValue: noopLogger(),
        },
        { provide: getLoggerToken(CacheService.name), useValue: noopLogger() },
      ],
    }).compile();

    await moduleRef.init();
    return moduleRef.get(DiscordAppService);
  };

  // Sample raw response shape — modeled on real Discord responses observed
  // for AC IV Black Flag.
  const sampleResponse = {
    id: '406637677199360030',
    name: "Assassin's Creed IV Black Flag",
    description: 'A pirate game',
    type: 5,
    icon: 'aaa',
    cover_image: 'bbb',
    aliases: ["Assassin's Creed IV: Black Flag"],
    third_party_skus: [
      { id: '1970', sku: '1970', distributor: 'igdb' },
      { id: '242050', sku: '242050', distributor: 'steam' },
      { id: '5684', sku: '5684', distributor: 'gdco' },
      { id: '316', sku: '316', distributor: 'opencritic' },
      { id: 'BRKMHZX1RCF2', sku: 'BRKMHZX1RCF2', distributor: 'xbox' },
      { id: 'somesku', distributor: 'epic' },
      { id: '20597', distributor: 'gop' },
    ],
  };

  it('first call misses cache, hits Discord, parses response', async () => {
    const service = await createService();
    httpGet.mockReturnValue(of({ data: sampleResponse }));

    const result = await service.fetchAppData('406637677199360030');

    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(httpGet).toHaveBeenCalledWith(
      'https://discord.com/api/v10/applications/406637677199360030/rpc',
      expect.objectContaining({ timeout: 5000 }),
    );
    expect(result).toMatchObject({
      id: '406637677199360030',
      name: "Assassin's Creed IV Black Flag",
      type: 5,
      igdb_id: 1970,
      steam_app_id: '242050',
      gog_id: '20597',
      epic_id: 'somesku',
      xbox_app_id: 'BRKMHZX1RCF2',
      opencritic_id: '316',
      aliases: ["Assassin's Creed IV: Black Flag"],
    });
  });

  it('second identical call hits cache; Discord is called once', async () => {
    const service = await createService();
    httpGet.mockReturnValue(of({ data: sampleResponse }));

    await service.fetchAppData('406637677199360030');
    const cached = await service.fetchAppData('406637677199360030');

    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(cached?.igdb_id).toBe(1970);
  });

  it('coalesces concurrent calls onto one Discord round-trip', async () => {
    const service = await createService();
    let resolveResponse: (v: { data: typeof sampleResponse }) => void = () => {};
    httpGet.mockReturnValue(
      // Manually controlled observable so we can assert timing.
      new (require('rxjs').Observable)(
        (subscriber: {
          next: (x: { data: typeof sampleResponse }) => void;
          complete: () => void;
        }) => {
          resolveResponse = (v) => {
            subscriber.next(v);
            subscriber.complete();
          };
        },
      ),
    );

    const a = service.fetchAppData('406637677199360030');
    const b = service.fetchAppData('406637677199360030');
    const c = service.fetchAppData('406637677199360030');

    resolveResponse({ data: sampleResponse });

    const [ra, rb, rc] = await Promise.all([a, b, c]);

    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(ra?.igdb_id).toBe(1970);
    expect(rb?.igdb_id).toBe(1970);
    expect(rc?.igdb_id).toBe(1970);
  });

  it('returns null and negative-caches a 404', async () => {
    const service = await createService();
    const err = new AxiosError('not found');
    Object.assign(err, { response: { status: 404 } });
    httpGet.mockReturnValueOnce(throwError(() => err));

    const result = await service.fetchAppData('999999999999999999');
    expect(result).toBeNull();

    // Second lookup hits the negative cache, no second HTTP call.
    const result2 = await service.fetchAppData('999999999999999999');
    expect(result2).toBeNull();
    expect(httpGet).toHaveBeenCalledTimes(1);
  });

  it('returns null on transient network error WITHOUT caching the failure', async () => {
    const service = await createService();
    httpGet
      .mockReturnValueOnce(throwError(() => new Error('econnreset')))
      .mockReturnValueOnce(of({ data: sampleResponse }));

    const failed = await service.fetchAppData('406637677199360030');
    expect(failed).toBeNull();

    // Retry — should hit Discord again, not the negative cache.
    const succeeded = await service.fetchAppData('406637677199360030');
    expect(succeeded?.igdb_id).toBe(1970);
    expect(httpGet).toHaveBeenCalledTimes(2);
  });

  it('parses a response with no third_party_skus into all-null distributors', async () => {
    const service = await createService();
    httpGet.mockReturnValue(
      of({
        data: {
          id: '111',
          name: 'Some Bot',
          type: 1,
          // no third_party_skus
        },
      }),
    );

    const result = await service.fetchAppData('111');
    expect(result).toMatchObject({
      id: '111',
      name: 'Some Bot',
      type: 1,
      igdb_id: null,
      steam_app_id: null,
      gog_id: null,
      epic_id: null,
      xbox_app_id: null,
      opencritic_id: null,
      aliases: [],
    });
  });

  it('parses a response with non-numeric igdb sku into igdb_id=null', async () => {
    const service = await createService();
    httpGet.mockReturnValue(
      of({
        data: {
          id: '222',
          name: 'Weird game',
          type: 5,
          third_party_skus: [
            { id: 'not-a-number', sku: 'not-a-number', distributor: 'igdb' },
          ],
        },
      }),
    );

    const result = await service.fetchAppData('222');
    expect(result?.igdb_id).toBeNull();
  });

  it('returns the bot type unchanged so the caller can decide how to handle it', async () => {
    const service = await createService();
    httpGet.mockReturnValue(
      of({
        data: { id: '333', name: 'carl-bot', type: 1, third_party_skus: [] },
      }),
    );

    const result = await service.fetchAppData('333');
    expect(result?.type).toBe(1);
    expect(result?.igdb_id).toBeNull();
  });
});
