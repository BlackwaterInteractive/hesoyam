import { userCache } from './user-cache.js';
import { isAgentActive } from '../supabase/users.js';
import {
  getActiveSession,
  createSession,
  closeSession,
  isSessionOwnedByAgent,
} from '../supabase/sessions.js';
import {
  broadcastGameStart,
  broadcastGameEnd,
  broadcastHeartbeat,
} from './presence-broadcaster.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import type { GameActivity, ActiveSession } from '../types/index.js';

// Grace period before actually closing a session (handles Discord presence flickers)
const END_GRACE_MS = 30_000;

/**
 * Tracks active sessions for Discord-monitored users
 */
class SessionTracker {
  // In-memory tracking of active Discord sessions
  // Maps Discord ID -> Active Session info
  private activeSessions: Map<string, ActiveSession> = new Map();

  // Pending end timers — if a game "ends" we wait before actually closing
  // Maps Discord ID -> timer handle
  private pendingEnds: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Handle a game change for a user
   */
  async handleGameChange(
    discordId: string,
    oldGame: GameActivity | null,
    newGame: GameActivity | null
  ): Promise<void> {
    const userId = userCache.getUserId(discordId);
    if (!userId) {
      logger.info('[SESSION] User not in cache, skipping', { discordId });
      return;
    }

    const localSession = this.activeSessions.get(discordId);
    const hasPendingEnd = this.pendingEnds.has(discordId);

    logger.info('[SESSION] handleGameChange called', {
      discordId,
      userId,
      oldGame: oldGame?.name ?? null,
      newGame: newGame?.name ?? null,
      localSessionExists: !!localSession,
      localSessionGame: localSession?.gameName ?? null,
      localSessionId: localSession?.id ?? null,
      localSessionStartedAt: localSession?.startedAt?.toISOString() ?? null,
      hasPendingEnd,
      activeSessCount: this.activeSessions.size,
      pendingEndCount: this.pendingEnds.size,
      timestamp: new Date().toISOString(),
    });

    // Check if agent is active (using fresh DB check for accuracy)
    const agentActive = await isAgentActive(userId, env.agentTimeoutMs);
    if (agentActive) {
      // Agent is handling tracking, clean up any Discord session we might have
      if (this.activeSessions.has(discordId)) {
        this.activeSessions.delete(discordId);
        logger.info('[SESSION] Agent took over, clearing Discord session', { userId, discordId });
      }
      this.cancelPendingEnd(discordId);
      return;
    }

    // Case 1: Game started (no game before, game now)
    if (!oldGame && newGame) {
      // Cancel any pending end — the game came back (presence flicker)
      if (this.cancelPendingEnd(discordId)) {
        logger.info('[SESSION] FLICKER RECOVERY: Game reappeared, cancelled pending close', {
          discordId,
          gameName: newGame.name,
          localSessionId: localSession?.id ?? null,
          timestamp: new Date().toISOString(),
        });
        // Update the local session's lastUpdate
        const active = this.activeSessions.get(discordId);
        if (active) {
          active.lastUpdate = new Date();
          return;
        }
      }
      // Check if we already have a local session for this game — gateway reconnect detection
      const existingLocal = this.activeSessions.get(discordId);
      if (existingLocal) {
        logger.warn('[SESSION] ⚠️ Case 1: GAME_START but LOCAL SESSION ALREADY EXISTS', {
          discordId,
          newGame: newGame.name,
          existingSessionId: existingLocal.id,
          existingGameName: existingLocal.gameName,
          existingStartedAt: existingLocal.startedAt.toISOString(),
          sameGame: existingLocal.gameName === newGame.name,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.info('[SESSION] Case 1: GAME_START — calling handleGameStart (no existing local session)', {
          discordId,
          gameName: newGame.name,
          timestamp: new Date().toISOString(),
        });
      }
      await this.handleGameStart(userId, discordId, newGame);
    }
    // Case 2: Game ended (game before, no game now)
    else if (oldGame && !newGame) {
      logger.info('[SESSION] Case 2: GAME_END — scheduling end with grace period', {
        discordId,
        gameName: oldGame.name,
        graceMs: END_GRACE_MS,
        localSessionId: localSession?.id ?? null,
        timestamp: new Date().toISOString(),
      });
      this.scheduleGameEnd(userId, discordId);
    }
    // Case 3: Game switched (different game)
    else if (oldGame && newGame && oldGame.name !== newGame.name) {
      logger.info('[SESSION] Case 3: GAME_SWITCH — closing old, starting new', {
        discordId,
        oldGame: oldGame.name,
        newGame: newGame.name,
        localSessionId: localSession?.id ?? null,
        timestamp: new Date().toISOString(),
      });
      // Switching games — immediately close old, start new
      this.cancelPendingEnd(discordId);
      await this.handleGameEnd(userId, discordId);
      await this.handleGameStart(userId, discordId, newGame);
    }
    // Case 4: Same game continues (heartbeat)
    else if (oldGame && newGame && oldGame.name === newGame.name) {
      // Game still active — cancel any pending end just in case
      const hadPending = this.cancelPendingEnd(discordId);
      if (hadPending) {
        logger.info('[SESSION] Case 4: HEARTBEAT — cancelled pending end (flicker)', {
          discordId,
          gameName: newGame.name,
          timestamp: new Date().toISOString(),
        });
      }
      await this.handleHeartbeat(userId, discordId, newGame);
    }
  }

  /**
   * Schedule a game end with a grace period to handle Discord presence flickers
   */
  private scheduleGameEnd(userId: string, discordId: string): void {
    // Don't double-schedule
    if (this.pendingEnds.has(discordId)) {
      logger.info('[SESSION] scheduleGameEnd: already pending, skipping', { discordId });
      return;
    }

    const activeSession = this.activeSessions.get(discordId);
    logger.info('[SESSION] scheduleGameEnd: starting grace timer', {
      discordId,
      userId,
      gameName: activeSession?.gameName ?? 'unknown',
      sessionId: activeSession?.id ?? null,
      graceMs: END_GRACE_MS,
      timestamp: new Date().toISOString(),
    });

    const graceStartedAt = new Date();
    const timer = setTimeout(async () => {
      this.pendingEnds.delete(discordId);
      const sessionDuration = activeSession
        ? Math.floor((Date.now() - activeSession.startedAt.getTime()) / 1000)
        : null;
      logger.warn('[SESSION] ⚠️ GRACE PERIOD EXPIRED — closing session now', {
        discordId,
        userId,
        gameName: activeSession?.gameName ?? 'unknown',
        sessionId: activeSession?.id ?? null,
        sessionDurationSecs: sessionDuration,
        graceStartedAt: graceStartedAt.toISOString(),
        graceDurationMs: Date.now() - graceStartedAt.getTime(),
        timestamp: new Date().toISOString(),
      });
      await this.handleGameEnd(userId, discordId);
    }, END_GRACE_MS);

    this.pendingEnds.set(discordId, timer);
  }

  /**
   * Cancel a pending game end timer. Returns true if there was one to cancel.
   */
  private cancelPendingEnd(discordId: string): boolean {
    const timer = this.pendingEnds.get(discordId);
    if (timer) {
      clearTimeout(timer);
      this.pendingEnds.delete(discordId);
      logger.info('[SESSION] cancelPendingEnd: timer cancelled', {
        discordId,
        timestamp: new Date().toISOString(),
      });
      return true;
    }
    return false;
  }

  /**
   * Handle game start
   */
  private async handleGameStart(
    userId: string,
    discordId: string,
    game: GameActivity
  ): Promise<void> {
    logger.info('[SESSION] handleGameStart: checking if agent owns session', {
      userId,
      discordId,
      gameName: game.name,
      timestamp: new Date().toISOString(),
    });

    // Check if session already owned by agent
    if (await isSessionOwnedByAgent(userId)) {
      logger.info('[SESSION] handleGameStart: SKIPPED — session owned by agent', {
        userId,
        gameName: game.name,
      });
      return;
    }

    // Create session in database
    logger.info('[SESSION] handleGameStart: creating DB session', {
      userId,
      discordId,
      gameName: game.name,
      gameStartedAt: game.startedAt?.toISOString() ?? null,
      timestamp: new Date().toISOString(),
    });

    const session = await createSession(userId, game);
    if (!session) {
      logger.error('[SESSION] handleGameStart: FAILED to create session', undefined, {
        userId,
        gameName: game.name,
      });
      return;
    }

    // Track locally
    this.activeSessions.set(discordId, {
      id: session.id,
      userId,
      discordId,
      gameName: game.name,
      startedAt: new Date(session.started_at),
      lastUpdate: new Date(),
    });

    logger.info('[SESSION] handleGameStart: SESSION CREATED AND TRACKED', {
      userId,
      discordId,
      gameName: game.name,
      sessionId: session.id,
      dbStartedAt: session.started_at,
      activeSessCount: this.activeSessions.size,
      timestamp: new Date().toISOString(),
    });

    // Broadcast presence
    await broadcastGameStart(userId, game);
  }

  /**
   * Handle game end
   */
  private async handleGameEnd(userId: string, discordId: string): Promise<void> {
    const localSession = this.activeSessions.get(discordId);

    const localDuration = localSession
      ? Math.floor((Date.now() - localSession.startedAt.getTime()) / 1000)
      : null;
    logger.warn('[SESSION] handleGameEnd: CLOSING session', {
      userId,
      discordId,
      localSessionExists: !!localSession,
      localSessionId: localSession?.id ?? null,
      localSessionGame: localSession?.gameName ?? null,
      localSessionStartedAt: localSession?.startedAt?.toISOString() ?? null,
      localSessionDurationSecs: localDuration,
      activeSessCount: this.activeSessions.size,
      pendingEndCount: this.pendingEnds.size,
      timestamp: new Date().toISOString(),
    });

    // Close session in database
    const closed = await closeSession(userId);

    // Remove from local tracking
    this.activeSessions.delete(discordId);

    logger.info('[SESSION] handleGameEnd: result', {
      userId,
      discordId,
      closed,
      gameName: localSession?.gameName ?? null,
      activeSessCount: this.activeSessions.size,
      timestamp: new Date().toISOString(),
    });

    if (closed) {
      // Broadcast presence end
      await broadcastGameEnd(userId);
    }
  }

  /**
   * Handle heartbeat (same game continues)
   */
  private async handleHeartbeat(
    userId: string,
    discordId: string,
    game: GameActivity
  ): Promise<void> {
    const activeSession = this.activeSessions.get(discordId);
    if (!activeSession) {
      // Session not tracked locally, might have started before bot
      logger.info('[SESSION] handleHeartbeat: no local session, creating one', {
        userId,
        discordId,
        gameName: game.name,
        timestamp: new Date().toISOString(),
      });
      await this.handleGameStart(userId, discordId, game);
      return;
    }

    // Update last update time
    activeSession.lastUpdate = new Date();

    // Broadcast heartbeat periodically (not on every presence update)
    // Discord sends presence updates frequently, we don't need to broadcast all of them
    const timeSinceLastBroadcast = Date.now() - activeSession.lastUpdate.getTime();
    if (timeSinceLastBroadcast >= 30000) { // 30 seconds
      await broadcastHeartbeat(userId, game);
    }
  }

  /**
   * Close all active sessions (used during graceful shutdown)
   */
  async closeAllSessions(): Promise<void> {
    const sessions = Array.from(this.activeSessions.values());
    if (sessions.length === 0) {
      logger.info('[SESSION] closeAllSessions: no active sessions to close');
      return;
    }

    logger.info('[SESSION] closeAllSessions: SHUTTING DOWN — closing all sessions', {
      count: sessions.length,
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        gameName: s.gameName,
        startedAt: s.startedAt.toISOString(),
      })),
      timestamp: new Date().toISOString(),
    });

    for (const session of sessions) {
      try {
        await closeSession(session.userId);
        logger.info('[SESSION] closeAllSessions: session closed', {
          userId: session.userId,
          gameName: session.gameName,
          sessionId: session.id,
        });
      } catch (error) {
        logger.error('[SESSION] closeAllSessions: FAILED to close session', error, {
          userId: session.userId,
          gameName: session.gameName,
        });
      }
    }

    // Clear pending end timers
    const pendingCount = this.pendingEnds.size;
    for (const [discordId, timer] of this.pendingEnds) {
      clearTimeout(timer);
    }
    this.pendingEnds.clear();
    this.activeSessions.clear();

    logger.info('[SESSION] closeAllSessions: complete', {
      closedCount: sessions.length,
      pendingEndsCleared: pendingCount,
    });
  }

  /**
   * Reconcile open DB sessions with current Discord presences on startup.
   * Adopts sessions for users who are still playing, closes stale ones.
   */
  async reconcileOnStartup(
    currentPresences: Map<string, GameActivity>
  ): Promise<void> {
    const supabase = (await import('../supabase/client.js')).getSupabase();

    // Find all open Discord sessions
    const { data: openSessions, error } = await supabase
      .from('game_sessions')
      .select('*')
      .is('ended_at', null)
      .eq('source', 'discord');

    if (error || !openSessions) {
      logger.error('[SESSION] reconcileOnStartup: failed to fetch open sessions', error);
      return;
    }

    if (openSessions.length === 0) {
      logger.info('[SESSION] reconcileOnStartup: no open sessions to reconcile');
      return;
    }

    logger.info('[SESSION] reconcileOnStartup: reconciling', {
      openSessionCount: openSessions.length,
      currentPresenceCount: currentPresences.size,
      presences: Array.from(currentPresences.entries()).map(([did, game]) => ({
        discordId: did,
        gameName: game.name,
      })),
      timestamp: new Date().toISOString(),
    });

    for (const session of openSessions) {
      // Find the discord ID for this user
      const discordId = userCache.getAllDiscordIds().find(
        (did) => userCache.getUserId(did) === session.user_id
      );

      if (!discordId) {
        // User not in cache, close the orphaned session
        await closeSession(session.user_id);
        logger.info('[SESSION] reconcileOnStartup: closed orphaned session (user not in cache)', {
          userId: session.user_id,
          gameName: session.game_name,
          sessionId: session.id,
        });
        continue;
      }

      const currentGame = currentPresences.get(discordId);

      if (currentGame && currentGame.name === session.game_name) {
        // User is still playing the same game — adopt the session
        this.activeSessions.set(discordId, {
          id: session.id,
          userId: session.user_id,
          discordId,
          gameName: session.game_name,
          startedAt: new Date(session.started_at),
          lastUpdate: new Date(),
        });
        logger.info('[SESSION] reconcileOnStartup: ADOPTED session', {
          userId: session.user_id,
          discordId,
          gameName: session.game_name,
          sessionId: session.id,
        });
      } else {
        // User stopped playing or switched games — close the old session
        await closeSession(session.user_id);
        logger.info('[SESSION] reconcileOnStartup: closed stale session', {
          userId: session.user_id,
          discordId,
          gameName: session.game_name,
          currentGame: currentGame?.name ?? null,
          sessionId: session.id,
        });
      }
    }
  }

  /**
   * Get all active sessions being tracked
   */
  getActiveSessions(): ActiveSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get the number of active sessions
   */
  get activeCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Check if a user has an active session tracked by Discord
   */
  hasActiveSession(discordId: string): boolean {
    return this.activeSessions.has(discordId);
  }

  /**
   * Get the game name of the active session for a user (for logging)
   */
  getActiveSessionGame(discordId: string): string | null {
    return this.activeSessions.get(discordId)?.gameName ?? null;
  }
}

// Singleton instance
export const sessionTracker = new SessionTracker();
