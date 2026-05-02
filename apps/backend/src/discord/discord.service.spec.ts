import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { DiscordService } from './discord.service';
import { SupabaseService } from '../core/supabase/supabase.service';

/**
 * The interesting behavior in syncGuildMembers is the asymmetric error
 * handling: phase 1 (mark current members in_guild) throws on failure;
 * phase 2 (mark dropped members not-in-guild) only warns. The phase 2
 * SQL also builds a fragile `not in (id1,id2,...)` string by joining
 * the array — worth pinning the format so a future refactor doesn't
 * break it silently.
 */
describe('DiscordService.syncGuildMembers', () => {
  let service: DiscordService;
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
    ['select', 'eq', 'is', 'not', 'in', 'update', 'insert', 'order', 'limit'].forEach(
      (m) => {
        c[m] = jest.fn(() => c);
      },
    );
    c.then = (resolve: (v: ChainResult) => unknown) =>
      Promise.resolve(result).then(resolve);
    return c as Record<string, jest.Mock> & PromiseLike<ChainResult>;
  };

  const buildService = async (): Promise<DiscordService> => {
    from = jest.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ from }) },
        },
        { provide: getLoggerToken(DiscordService.name), useValue: noopLogger() },
      ],
    }).compile();
    return moduleRef.get(DiscordService);
  };

  beforeEach(async () => {
    service = await buildService();
  });

  const members = [
    { discordId: '111' },
    { discordId: '222' },
    { discordId: '333' },
  ];

  it('happy path: marks members in_guild=true, then marks others false; returns synced count', async () => {
    const phase1 = chain({ data: null, error: null });
    const phase2 = chain({ data: null, error: null });
    from.mockReturnValueOnce(phase1).mockReturnValueOnce(phase2);

    const result = await service.syncGuildMembers(members);

    // Phase 1 — set in_guild true for the supplied ids
    expect(from).toHaveBeenNthCalledWith(1, 'profiles');
    expect(phase1.update).toHaveBeenCalledWith({ in_guild: true });
    expect(phase1.in).toHaveBeenCalledWith('discord_id', ['111', '222', '333']);

    // Phase 2 — set false for previously-flagged users not in the new payload
    expect(from).toHaveBeenNthCalledWith(2, 'profiles');
    expect(phase2.update).toHaveBeenCalledWith({ in_guild: false });
    expect(phase2.not).toHaveBeenCalledWith('discord_id', 'in', '(111,222,333)');
    expect(phase2.eq).toHaveBeenCalledWith('in_guild', true);
    expect(phase2.not).toHaveBeenCalledWith('discord_id', 'is', null);

    expect(result).toEqual({ synced: 3 });
  });

  it('phase 1 error: throws and never runs phase 2', async () => {
    from.mockReturnValueOnce(
      chain({ data: null, error: { message: 'rls denied' } }),
    );

    await expect(service.syncGuildMembers(members)).rejects.toMatchObject({
      message: 'rls denied',
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('phase 2 error: returns synced count anyway (warns, does not throw)', async () => {
    from
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(
        chain({ data: null, error: { message: 'phase 2 broke' } }),
      );

    const result = await service.syncGuildMembers(members);

    expect(result).toEqual({ synced: 3 });
  });

  it('empty member list: still issues both updates with empty filters', async () => {
    const phase1 = chain({ data: null, error: null });
    const phase2 = chain({ data: null, error: null });
    from.mockReturnValueOnce(phase1).mockReturnValueOnce(phase2);

    const result = await service.syncGuildMembers([]);

    expect(phase1.in).toHaveBeenCalledWith('discord_id', []);
    expect(phase2.not).toHaveBeenCalledWith('discord_id', 'in', '()');
    expect(result).toEqual({ synced: 0 });
  });
});
