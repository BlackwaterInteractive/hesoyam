import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────
// Must be hoisted before any imports that use them.

// Mock env — required by session-tracker at import time
vi.mock('../../config/env.js', () => ({
  env: {
    discordGuildId: 'guild-123',
    agentTimeoutMs: 60_000,
    logLevel: 'debug',
  },
}));

// Mock logger — capture log calls for assertion
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  presence: vi.fn(),
};
vi.mock('../../utils/logger.js', () => ({ logger: mockLogger }));

// Mock user-cache
const mockUserCache = {
  getUserId: vi.fn(),
  getAllDiscordIds: vi.fn(() => []),
  has: vi.fn(),
  get: vi.fn(),
  size: 0,
};
vi.mock('../user-cache.js', () => ({ userCache: mockUserCache }));

// Mock supabase/users
vi.mock('../../supabase/users.js', () => ({
  isAgentActive: vi.fn().mockResolvedValue(false),
}));

// Mock supabase/sessions
const mockCreateSession = vi.fn();
const mockCloseSession = vi.fn().mockResolvedValue(true);
const mockIsSessionOwnedByAgent = vi.fn().mockResolvedValue(false);
const mockTouchActiveSessions = vi.fn();
vi.mock('../../supabase/sessions.js', () => ({
  getActiveSession: vi.fn(),
  createSession: mockCreateSession,
  closeSession: mockCloseSession,
  isSessionOwnedByAgent: mockIsSessionOwnedByAgent,
  touchActiveSessions: mockTouchActiveSessions,
}));

// Mock presence-broadcaster
vi.mock('../presence-broadcaster.js', () => ({
  broadcastGameStart: vi.fn(),
  broadcastGameEnd: vi.fn(),
  broadcastHeartbeat: vi.fn(),
}));

// Build a fake Discord guild presence cache
function makePresenceCache(entries: Record<string, { type: number; name: string }[]>) {
  const map = new Map<string, { activities: { type: number; name: string }[] }>();
  for (const [id, activities] of Object.entries(entries)) {
    map.set(id, { activities });
  }
  return { get: (id: string) => map.get(id) };
}

function makeGuild(presences: ReturnType<typeof makePresenceCache>) {
  return { presences: { cache: presences } };
}

// Mock discord client — we'll set up the guild per-test
let mockGuild: ReturnType<typeof makeGuild> | undefined;
vi.mock('../../discord/client.js', () => ({
  getDiscordClient: () => ({
    guilds: {
      cache: {
        get: (id: string) => (id === 'guild-123' ? mockGuild : undefined),
      },
    },
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a fresh SessionTracker for each test (bypasses singleton) */
async function createTracker() {
  // Re-import to get a fresh class (vitest module cache is reset per test via vi.resetModules if needed)
  const mod = await import('../session-tracker.js');
  // The module exports a singleton — we can access the class through it
  // but since it's a singleton, we need to work with it directly.
  // We'll use handleGameChange to set up state, then call verifyActiveSessions.
  return mod.sessionTracker;
}

function makeGameActivity(name: string) {
  return {
    name,
    applicationId: null,
    details: null,
    state: null,
    startedAt: new Date(),
    largeImageUrl: null,
    smallImageUrl: null,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('verifyActiveSessions', () => {
  let tracker: Awaited<ReturnType<typeof createTracker>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    tracker = await createTracker();

    // Default: userCache resolves discord→user mappings
    mockUserCache.getUserId.mockImplementation((discordId: string) => {
      const map: Record<string, string> = {
        'discord-1': 'user-1',
        'discord-2': 'user-2',
      };
      return map[discordId];
    });

    // Default: createSession returns a CreateSessionResult
    mockCreateSession.mockImplementation((_userId: string, game: { name: string }) => ({
      session: {
        id: `session-${Date.now()}`,
        user_id: _userId,
        game_name: game.name,
        started_at: new Date().toISOString(),
        source: 'discord',
      },
      resolvedGame: {
        id: `game-${Date.now()}`,
        name: game.name,
        slug: game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        cover_url: null,
      },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up: close all sessions to reset singleton state
    tracker.getActiveSessions().forEach(() => {});
    // Force clear internal maps via closeAllSessions (ignore async)
    tracker.closeAllSessions();
  });

  // ── Scenario 1: No active sessions — does nothing ──────────────────────

  it('does nothing when there are no active sessions', async () => {
    mockGuild = makeGuild(makePresenceCache({}));

    await tracker.verifyActiveSessions();

    // No warn logs should fire
    const verifyCalls = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[VERIFY]')
    );
    expect(verifyCalls).toHaveLength(0);
  });

  // ── Scenario 2: User still playing same game — no action ───────────────

  it('takes no action when user is still playing the tracked game', async () => {
    // Set up: user-1 playing "Elden Ring"
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 0, name: 'Elden Ring' }],
      })
    );

    // Start a session via handleGameChange
    await tracker.handleGameChange('discord-1', null, makeGameActivity('Elden Ring'));

    vi.clearAllMocks(); // clear setup logs

    // Verify — user is still playing Elden Ring
    await tracker.verifyActiveSessions();

    // Should NOT schedule any end
    const verifyCalls = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[VERIFY]')
    );
    expect(verifyCalls).toHaveLength(0);

    // Session should still be active
    expect(tracker.activeCount).toBe(1);
    expect(tracker.getActiveSessionGame('discord-1')).toBe('Elden Ring');
  });

  // ── Scenario 3: Missed quit — stale session detected & closed ──────────

  it('detects stale session when user is no longer playing (missed quit)', async () => {
    // Set up: user-1 playing "Elden Ring"
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 0, name: 'Elden Ring' }],
      })
    );

    await tracker.handleGameChange('discord-1', null, makeGameActivity('Elden Ring'));
    vi.clearAllMocks();

    // Now the user quit — Discord presence shows no game
    mockGuild = makeGuild(makePresenceCache({ 'discord-1': [] }));

    await tracker.verifyActiveSessions();

    // Should log [VERIFY] stale detection
    const verifyCalls = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[VERIFY]')
    );
    expect(verifyCalls).toHaveLength(1);
    expect(verifyCalls[0][1]).toMatchObject({
      discordId: 'discord-1',
      trackedGame: 'Elden Ring',
      currentGame: null,
    });

    // Grace period should be scheduled (session still active for 30s)
    expect(tracker.activeCount).toBe(1);

    // Fast-forward 30s grace period
    mockCloseSession.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(30_000);

    // Session should now be closed
    expect(tracker.activeCount).toBe(0);
    expect(mockCloseSession).toHaveBeenCalledWith('user-1');

    // Should log grace period expired
    const graceLogs = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('GRACE PERIOD EXPIRED')
    );
    expect(graceLogs).toHaveLength(1);
  });

  // ── Scenario 4: User went offline (presence undefined) ─────────────────

  it('detects stale session when user goes offline (presence undefined)', async () => {
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 0, name: 'Celeste' }],
      })
    );

    await tracker.handleGameChange('discord-1', null, makeGameActivity('Celeste'));
    vi.clearAllMocks();

    // User went offline — presence cache returns undefined
    mockGuild = makeGuild(makePresenceCache({})); // discord-1 not in cache at all

    await tracker.verifyActiveSessions();

    const verifyCalls = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[VERIFY]')
    );
    expect(verifyCalls).toHaveLength(1);
    expect(verifyCalls[0][1]).toMatchObject({
      discordId: 'discord-1',
      trackedGame: 'Celeste',
      currentGame: null,
    });

    // Let grace expire
    await vi.advanceTimersByTimeAsync(30_000);
    expect(tracker.activeCount).toBe(0);
  });

  // ── Scenario 5: Game switch not caught — different game detected ────────

  it('detects stale session when user switched to a different game', async () => {
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 0, name: 'Elden Ring' }],
      })
    );

    await tracker.handleGameChange('discord-1', null, makeGameActivity('Elden Ring'));
    vi.clearAllMocks();

    // User switched to Celeste but Discord missed the event
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 0, name: 'Celeste' }],
      })
    );

    await tracker.verifyActiveSessions();

    const verifyCalls = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[VERIFY]')
    );
    expect(verifyCalls).toHaveLength(1);
    expect(verifyCalls[0][1]).toMatchObject({
      discordId: 'discord-1',
      trackedGame: 'Elden Ring',
      currentGame: 'Celeste',
    });
  });

  // ── Scenario 6: Flicker recovery — game reappears within grace ─────────

  it('cancels close if game reappears during grace period (flicker)', async () => {
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 0, name: 'Elden Ring' }],
      })
    );

    await tracker.handleGameChange('discord-1', null, makeGameActivity('Elden Ring'));
    vi.clearAllMocks();

    // Presence drops — verify catches it
    mockGuild = makeGuild(makePresenceCache({ 'discord-1': [] }));
    await tracker.verifyActiveSessions();

    // Grace period is running. Now 15s later, game reappears via presence update
    await vi.advanceTimersByTimeAsync(15_000);

    // Discord sends a presence update: game is back
    await tracker.handleGameChange('discord-1', null, makeGameActivity('Elden Ring'));

    // Advance past the original grace period
    await vi.advanceTimersByTimeAsync(20_000);

    // Session should still be alive — flicker was recovered
    expect(tracker.activeCount).toBe(1);
    expect(tracker.getActiveSessionGame('discord-1')).toBe('Elden Ring');

    // closeSession should NOT have been called
    expect(mockCloseSession).not.toHaveBeenCalled();

    // Should see flicker recovery log
    const flickerLogs = mockLogger.info.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('FLICKER RECOVERY')
    );
    expect(flickerLogs).toHaveLength(1);
  });

  // ── Scenario 7: Skips if grace period already pending ──────────────────

  it('skips sessions that already have a pending end timer', async () => {
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 0, name: 'Elden Ring' }],
      })
    );

    await tracker.handleGameChange('discord-1', null, makeGameActivity('Elden Ring'));
    vi.clearAllMocks();

    // First verify — triggers grace
    mockGuild = makeGuild(makePresenceCache({ 'discord-1': [] }));
    await tracker.verifyActiveSessions();

    const firstCalls = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[VERIFY]')
    );
    expect(firstCalls).toHaveLength(1);

    vi.clearAllMocks();

    // Second verify 10s later — should skip (grace already pending)
    await vi.advanceTimersByTimeAsync(10_000);
    await tracker.verifyActiveSessions();

    const secondCalls = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[VERIFY]')
    );
    expect(secondCalls).toHaveLength(0);
  });

  // ── Scenario 8: Multiple users — only stale ones affected ──────────────

  it('only closes stale sessions, leaves valid ones untouched', async () => {
    // Both users playing
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 0, name: 'Elden Ring' }],
        'discord-2': [{ type: 0, name: 'Celeste' }],
      })
    );

    await tracker.handleGameChange('discord-1', null, makeGameActivity('Elden Ring'));
    await tracker.handleGameChange('discord-2', null, makeGameActivity('Celeste'));
    expect(tracker.activeCount).toBe(2);
    vi.clearAllMocks();

    // User 1 quit (missed event), User 2 still playing
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [], // no game
        'discord-2': [{ type: 0, name: 'Celeste' }], // still playing
      })
    );

    await tracker.verifyActiveSessions();

    // Only discord-1 should be flagged
    const verifyCalls = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[VERIFY]')
    );
    expect(verifyCalls).toHaveLength(1);
    expect(verifyCalls[0][1].discordId).toBe('discord-1');

    // Let grace expire
    await vi.advanceTimersByTimeAsync(30_000);

    // User 1 closed, User 2 still active
    expect(tracker.activeCount).toBe(1);
    expect(tracker.hasActiveSession('discord-1')).toBe(false);
    expect(tracker.hasActiveSession('discord-2')).toBe(true);
  });

  // ── Scenario 9: No guild found — does nothing ─────────────────────────

  it('does nothing when guild is not in cache', async () => {
    mockGuild = undefined; // guild not found

    // Manually inject a session to test (use handleGameChange first with a valid guild)
    const tempGuild = makeGuild(
      makePresenceCache({ 'discord-1': [{ type: 0, name: 'Elden Ring' }] })
    );
    mockGuild = tempGuild;
    await tracker.handleGameChange('discord-1', null, makeGameActivity('Elden Ring'));
    vi.clearAllMocks();

    // Now guild disappears
    mockGuild = undefined;

    await tracker.verifyActiveSessions();

    // No verify logs — method returned early
    const verifyCalls = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[VERIFY]')
    );
    expect(verifyCalls).toHaveLength(0);

    // Session still tracked (not falsely closed)
    expect(tracker.activeCount).toBe(1);
  });

  // ── Scenario 10: Non-playing activity (listening, streaming) ignored ───

  it('detects stale session when user has non-playing activities only', async () => {
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 0, name: 'Elden Ring' }],
      })
    );

    await tracker.handleGameChange('discord-1', null, makeGameActivity('Elden Ring'));
    vi.clearAllMocks();

    // User stopped playing, now only has a "Listening to Spotify" activity (type 2)
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 2, name: 'Spotify' }],
      })
    );

    await tracker.verifyActiveSessions();

    const verifyCalls = mockLogger.warn.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[VERIFY]')
    );
    expect(verifyCalls).toHaveLength(1);
    expect(verifyCalls[0][1]).toMatchObject({
      trackedGame: 'Elden Ring',
      currentGame: null, // no type=0 activity found
    });
  });

  // ── Scenario 11: Full lifecycle — heartbeat → verify → grace → close ──

  it('full lifecycle: heartbeat logs, verify detects, grace expires, session closes', async () => {
    mockGuild = makeGuild(
      makePresenceCache({
        'discord-1': [{ type: 0, name: 'Hades' }],
      })
    );

    // Start session
    await tracker.handleGameChange('discord-1', null, makeGameActivity('Hades'));
    expect(tracker.activeCount).toBe(1);

    // Simulate what ready.ts heartbeat does
    const activeSessions = tracker.getActiveSessions();
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].gameName).toBe('Hades');

    vi.clearAllMocks();

    // User quits — presence cache updates but no event fired
    mockGuild = makeGuild(makePresenceCache({ 'discord-1': [] }));

    // Heartbeat fires verify
    await tracker.verifyActiveSessions();

    // Verify detection logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[VERIFY] Stale session detected — user no longer playing',
      expect.objectContaining({
        discordId: 'discord-1',
        trackedGame: 'Hades',
        currentGame: null,
      })
    );

    // Grace timer scheduled logged
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[SESSION] scheduleGameEnd: starting grace timer',
      expect.objectContaining({
        discordId: 'discord-1',
      })
    );

    // Session still active during grace
    expect(tracker.activeCount).toBe(1);

    // Advance through grace period
    await vi.advanceTimersByTimeAsync(30_000);

    // Grace expired — session closed
    expect(tracker.activeCount).toBe(0);
    expect(mockCloseSession).toHaveBeenCalledWith('user-1');

    // Verify the grace expiry was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[SESSION] ⚠️ GRACE PERIOD EXPIRED — closing session now',
      expect.objectContaining({
        discordId: 'discord-1',
        gameName: 'Hades',
      })
    );
  });
});
