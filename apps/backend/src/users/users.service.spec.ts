import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getLoggerToken } from 'nestjs-pino';
import { UsersService } from './users.service';
import { CacheService } from '../core/cache/cache.service';
import { SupabaseService } from '../core/supabase/supabase.service';

/**
 * Covers the cache-miss → DB → cache-populate path. Uses the real
 * CacheService (matches the integration-style mocking used in
 * igdb.service.spec.ts and game-resolver.service.spec.ts) so we verify
 * actual cache semantics, not a mock of them.
 */
describe('UsersService.getUserIdByDiscordId', () => {
  let service: UsersService;
  let from: jest.Mock;

  const noopLogger = () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  });

  type ChainResult = { data: unknown; error: unknown };
  const chain = (result: ChainResult) => {
    const c: Record<string, jest.Mock | unknown> = {};
    ['select', 'eq', 'is', 'not', 'order', 'limit'].forEach((m) => {
      c[m] = jest.fn(() => c);
    });
    c.single = jest.fn().mockResolvedValue(result);
    c.then = (resolve: (v: ChainResult) => unknown) =>
      Promise.resolve(result).then(resolve);
    return c as Record<string, jest.Mock> & PromiseLike<ChainResult>;
  };

  const buildService = async (): Promise<UsersService> => {
    from = jest.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        CacheService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ from }) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: <T>(_k: string, d: T): T => d,
            getOrThrow: jest.fn().mockReturnValue('fake'),
          },
        },
        { provide: getLoggerToken(UsersService.name), useValue: noopLogger() },
        { provide: getLoggerToken(CacheService.name), useValue: noopLogger() },
      ],
    }).compile();

    await moduleRef.init(); // registers the user-discord cache bucket
    return moduleRef.get(UsersService);
  };

  beforeEach(async () => {
    service = await buildService();
  });

  it('cache miss → DB hit: returns the user id and populates the cache', async () => {
    from.mockReturnValueOnce(
      chain({ data: { id: 'user-uuid-1' }, error: null }),
    );

    const result = await service.getUserIdByDiscordId('discord-123');

    expect(result).toBe('user-uuid-1');
    expect(from).toHaveBeenCalledWith('profiles');
  });

  it('second call with same id hits the cache (no second DB query)', async () => {
    from.mockReturnValueOnce(
      chain({ data: { id: 'user-uuid-1' }, error: null }),
    );

    await service.getUserIdByDiscordId('discord-123');
    const second = await service.getUserIdByDiscordId('discord-123');

    expect(second).toBe('user-uuid-1');
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('cache miss → DB miss: returns null and does NOT populate the cache', async () => {
    from.mockReturnValue(chain({ data: null, error: null }));

    const first = await service.getUserIdByDiscordId('unknown-discord');
    const second = await service.getUserIdByDiscordId('unknown-discord');

    expect(first).toBeNull();
    expect(second).toBeNull();
    // Both calls hit the DB — no negative caching for unknown ids
    expect(from).toHaveBeenCalledTimes(2);
  });
});
