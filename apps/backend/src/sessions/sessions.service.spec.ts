import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { SessionsService } from './sessions.service';
import { SupabaseService } from '../core/supabase/supabase.service';
import { GameResolverService } from '../games/game-resolver.service';
import { PresenceService } from '../presence/presence.service';
import { ResolvedGame } from '../games/games.service';

/**
 * Covers the SessionsService state machine — startSession in particular,
 * which has the highest branch density of any backend service:
 *   - active session for same game → idempotent return
 *   - active session for different game → close-and-restart
 *   - no active + matching last-session launch → reopen via RPC
 *   - reopen RPC fails → fall through to fresh create
 *   - no active + no reopen match → fresh create
 *
 * Plus endSession (RPC + broadcast + null when no active), heartbeat
 * (update with .is(null) filter), and cleanupStaleSessions (cron + RPC).
 */
describe('SessionsService', () => {
  let service: SessionsService;
  let from: jest.Mock;
  let rpc: jest.Mock;
  let resolverResolve: jest.Mock;
  let presenceBroadcast: jest.Mock;

  const noopLogger = () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  });

  /**
   * A thenable chain mock: every Supabase query method (.select, .eq, .is,
   * .not, .order, .limit, .update, .insert) returns the same chain object
   * so any call sequence is valid; .single() and direct await both resolve
   * to the configured `result` ({ data, error } shape).
   */
  type ChainResult = { data: unknown; error: unknown };
  const chain = (result: ChainResult) => {
    const c: Record<string, jest.Mock | unknown> = {};
    ['select', 'eq', 'is', 'not', 'order', 'limit', 'in', 'update', 'insert'].forEach(
      (m) => {
        c[m] = jest.fn(() => c);
      },
    );
    c.single = jest.fn().mockResolvedValue(result);
    // Make the chain itself awaitable (heartbeat awaits the chain without .single)
    c.then = (resolve: (v: ChainResult) => unknown) =>
      Promise.resolve(result).then(resolve);
    return c as Record<string, jest.Mock> & PromiseLike<ChainResult>;
  };

  const buildService = async (): Promise<SessionsService> => {
    from = jest.fn();
    rpc = jest.fn();
    resolverResolve = jest.fn();
    presenceBroadcast = jest.fn().mockResolvedValue(undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ from, rpc }) },
        },
        {
          provide: GameResolverService,
          useValue: { resolve: resolverResolve },
        },
        {
          provide: PresenceService,
          useValue: { broadcast: presenceBroadcast },
        },
        {
          provide: getLoggerToken(SessionsService.name),
          useValue: noopLogger(),
        },
      ],
    }).compile();
    return moduleRef.get(SessionsService);
  };

  beforeEach(async () => {
    service = await buildService();
  });

  const baseDto = {
    userId: 'user-1',
    discordId: 'discord-1',
    gameName: 'Hades',
    source: 'discord' as const,
  };

  const resolved: ResolvedGame = {
    id: 'game-uuid',
    name: 'Hades',
    slug: 'hades',
    cover_url: 'https://example.com/hades.jpg',
    igdb_id: 113112,
  };

  describe('startSession', () => {
    it('idempotent: returns the existing session when same game is already active', async () => {
      const activeSession = {
        id: 'session-existing',
        game_name: 'Hades',
        game_id: 'game-uuid',
        user_id: 'user-1',
      };
      from.mockReturnValueOnce(chain({ data: activeSession, error: null }));

      const result = await service.startSession(baseDto);

      expect(result).toEqual({ session: activeSession, reopened: false });
      expect(resolverResolve).not.toHaveBeenCalled();
      expect(presenceBroadcast).not.toHaveBeenCalled();
      expect(from).toHaveBeenCalledTimes(1);
    });

    it('different game already active: closes existing first, then creates new', async () => {
      const oldActive = {
        id: 'session-old',
        game_name: 'OldGame',
        game_id: 'old-game-uuid',
        user_id: 'user-1',
      };
      const closedByEnd = { id: 'session-old', ended_at: '2026-04-30T00:00:00Z' };
      const newSession = {
        id: 'session-new',
        game_name: 'Hades',
        started_at: '2026-04-30T00:00:01Z',
      };

      from
        .mockReturnValueOnce(chain({ data: oldActive, error: null })) // active check
        .mockReturnValueOnce(chain({ data: newSession, error: null })); // insert
      rpc.mockResolvedValueOnce({ data: [closedByEnd], error: null }); // close_session_returning
      resolverResolve.mockResolvedValue(resolved);

      const result = await service.startSession(baseDto);

      // endSession was triggered (close RPC + 'end' broadcast)
      expect(rpc).toHaveBeenCalledWith(
        'close_session_returning',
        expect.objectContaining({ p_user_id: 'user-1' }),
      );
      expect(presenceBroadcast).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ event: 'end' }),
      );
      // New session created and broadcast
      expect(resolverResolve).toHaveBeenCalledWith('Hades', undefined);
      expect(presenceBroadcast).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          event: 'start',
          game_name: 'Hades',
          started_at: '2026-04-30T00:00:01Z',
        }),
      );
      expect(result).toEqual({
        session: newSession,
        resolvedGame: resolved,
        reopened: false,
      });
    });

    it('reopen path: same game + same launch timestamp → calls reopen RPC and broadcasts start', async () => {
      const launchedAt = '2026-04-30T12:00:00.000Z';
      const lastSession = {
        id: 'session-prev',
        game_name: 'Hades',
        game_id: 'game-uuid',
        game_slug: 'hades',
        cover_url: null,
        started_at: launchedAt,
        ended_at: '2026-04-30T13:00:00.000Z',
      };
      const reopened = { ...lastSession, ended_at: null };

      from
        .mockReturnValueOnce(chain({ data: null, error: null })) // no active
        .mockReturnValueOnce(chain({ data: lastSession, error: null })) // last session
        .mockReturnValueOnce(chain({ data: reopened, error: null })); // refetch after reopen
      rpc.mockResolvedValueOnce({ data: null, error: null }); // reopen_session_atomic

      const result = await service.startSession({
        ...baseDto,
        startedAt: launchedAt,
      });

      expect(rpc).toHaveBeenCalledWith(
        'reopen_session_atomic',
        expect.objectContaining({ p_session_id: 'session-prev' }),
      );
      expect(presenceBroadcast).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ event: 'start', started_at: launchedAt }),
      );
      expect(result).toEqual({ session: reopened, reopened: true });
      expect(resolverResolve).not.toHaveBeenCalled();
    });

    it('reopen RPC failure: falls through to fresh-create path', async () => {
      const launchedAt = '2026-04-30T12:00:00.000Z';
      const lastSession = {
        id: 'session-prev',
        game_name: 'Hades',
        game_id: 'game-uuid',
        started_at: launchedAt,
        ended_at: '2026-04-30T13:00:00.000Z',
      };
      const newSession = {
        id: 'session-new',
        game_name: 'Hades',
        started_at: launchedAt,
      };

      from
        .mockReturnValueOnce(chain({ data: null, error: null })) // no active
        .mockReturnValueOnce(chain({ data: lastSession, error: null })) // last session
        .mockReturnValueOnce(chain({ data: newSession, error: null })); // insert
      rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc fail' } }); // reopen fails
      resolverResolve.mockResolvedValue(resolved);

      const result = await service.startSession({
        ...baseDto,
        startedAt: launchedAt,
      });

      expect(resolverResolve).toHaveBeenCalled();
      expect(result).toEqual({
        session: newSession,
        resolvedGame: resolved,
        reopened: false,
      });
    });

    it('fresh create: no active, no reopen match → resolve + insert + broadcast', async () => {
      const newSession = {
        id: 'session-new',
        game_name: 'Hades',
        started_at: '2026-04-30T12:00:00Z',
      };

      from
        .mockReturnValueOnce(chain({ data: null, error: null })) // no active
        .mockReturnValueOnce(chain({ data: newSession, error: null })); // insert (no startedAt → no last-session check)
      resolverResolve.mockResolvedValue(resolved);

      const result = await service.startSession(baseDto);

      expect(resolverResolve).toHaveBeenCalledWith('Hades', undefined);
      expect(presenceBroadcast).toHaveBeenCalledTimes(1);
      expect(presenceBroadcast).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          event: 'start',
          game_name: 'Hades',
          cover_url: 'https://example.com/hades.jpg',
        }),
      );
      expect(result).toEqual({
        session: newSession,
        resolvedGame: resolved,
        reopened: false,
      });
    });

    it('throws when the insert fails', async () => {
      from
        .mockReturnValueOnce(chain({ data: null, error: null }))
        .mockReturnValueOnce(chain({ data: null, error: { message: 'db error' } }));
      resolverResolve.mockResolvedValue(resolved);

      await expect(service.startSession(baseDto)).rejects.toMatchObject({
        message: 'db error',
      });
    });
  });

  describe('endSession', () => {
    it('closes via RPC and broadcasts an end event', async () => {
      const closed = { id: 'session-1', user_id: 'user-1', ended_at: '...' };
      rpc.mockResolvedValue({ data: [closed], error: null });

      const result = await service.endSession({
        userId: 'user-1',
        discordId: 'discord-1',
        source: 'discord',
      });

      expect(rpc).toHaveBeenCalledWith(
        'close_session_returning',
        expect.objectContaining({ p_user_id: 'user-1', p_source: 'discord' }),
      );
      expect(presenceBroadcast).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          event: 'end',
          game_name: null,
          started_at: null,
        }),
      );
      expect(result).toEqual(closed);
    });

    it('returns null and skips broadcast when there is no active session', async () => {
      rpc.mockResolvedValue({ data: null, error: null });

      const result = await service.endSession({
        userId: 'user-1',
        discordId: 'discord-1',
      });

      expect(result).toBeNull();
      expect(presenceBroadcast).not.toHaveBeenCalled();
    });

    it('throws when the RPC errors', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'rpc broke' } });

      await expect(
        service.endSession({ userId: 'user-1', discordId: 'discord-1' }),
      ).rejects.toMatchObject({ message: 'rpc broke' });
    });
  });

  describe('heartbeat', () => {
    it('completes silently on success', async () => {
      from.mockReturnValueOnce(chain({ data: null, error: null }));

      await expect(
        service.heartbeat({ userId: 'user-1' }),
      ).resolves.toBeUndefined();
    });

    it('throws when the update errors', async () => {
      from.mockReturnValueOnce(
        chain({ data: null, error: { message: 'heartbeat failed' } }),
      );

      await expect(service.heartbeat({ userId: 'user-1' })).rejects.toMatchObject({
        message: 'heartbeat failed',
      });
    });
  });

  describe('cleanupStaleSessions', () => {
    it('logs (does not throw) when the RPC errors', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'rpc fail' } });

      await expect(service.cleanupStaleSessions()).resolves.toBeUndefined();
    });

    it('completes silently when zero sessions are closed', async () => {
      rpc.mockResolvedValue({ data: 0, error: null });

      await expect(service.cleanupStaleSessions()).resolves.toBeUndefined();
    });

    it('completes silently when N sessions are closed', async () => {
      rpc.mockResolvedValue({ data: 7, error: null });

      await expect(service.cleanupStaleSessions()).resolves.toBeUndefined();
      expect(rpc).toHaveBeenCalledWith('close_stale_sessions');
    });
  });
});
