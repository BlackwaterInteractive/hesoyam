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
      logger.debug('User not in cache, skipping', { discordId });
      return;
    }

    // Check if agent is active (using fresh DB check for accuracy)
    const agentActive = await isAgentActive(userId, env.agentTimeoutMs);
    if (agentActive) {
      // Agent is handling tracking, clean up any Discord session we might have
      if (this.activeSessions.has(discordId)) {
        this.activeSessions.delete(discordId);
        logger.debug('Agent took over, clearing Discord session', { userId, discordId });
      }
      this.cancelPendingEnd(discordId);
      return;
    }

    // Case 1: Game started (no game before, game now)
    if (!oldGame && newGame) {
      // Cancel any pending end — the game came back (presence flicker)
      if (this.cancelPendingEnd(discordId)) {
        logger.info('Game reappeared, cancelled pending session close', {
          discordId,
          gameName: newGame.name,
        });
        // Update the local session's lastUpdate
        const active = this.activeSessions.get(discordId);
        if (active) {
          active.lastUpdate = new Date();
          return;
        }
      }
      await this.handleGameStart(userId, discordId, newGame);
    }
    // Case 2: Game ended (game before, no game now)
    else if (oldGame && !newGame) {
      this.scheduleGameEnd(userId, discordId);
    }
    // Case 3: Game switched (different game)
    else if (oldGame && newGame && oldGame.name !== newGame.name) {
      // Switching games — immediately close old, start new
      this.cancelPendingEnd(discordId);
      await this.handleGameEnd(userId, discordId);
      await this.handleGameStart(userId, discordId, newGame);
    }
    // Case 4: Same game continues (heartbeat)
    else if (oldGame && newGame && oldGame.name === newGame.name) {
      // Game still active — cancel any pending end just in case
      this.cancelPendingEnd(discordId);
      await this.handleHeartbeat(userId, discordId, newGame);
    }
  }

  /**
   * Schedule a game end with a grace period to handle Discord presence flickers
   */
  private scheduleGameEnd(userId: string, discordId: string): void {
    // Don't double-schedule
    if (this.pendingEnds.has(discordId)) return;

    const activeSession = this.activeSessions.get(discordId);
    logger.info('Game disappeared, waiting before closing session', {
      discordId,
      gameName: activeSession?.gameName ?? 'unknown',
      graceMs: END_GRACE_MS,
    });

    const timer = setTimeout(async () => {
      this.pendingEnds.delete(discordId);
      logger.info('Grace period expired, closing session', {
        discordId,
        gameName: activeSession?.gameName ?? 'unknown',
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
    // Check if session already owned by agent
    if (await isSessionOwnedByAgent(userId)) {
      logger.debug('Session owned by agent, skipping start', { userId, gameName: game.name });
      return;
    }

    // Create session in database
    const session = await createSession(userId, game);
    if (!session) {
      logger.error('Failed to create session', undefined, { userId, gameName: game.name });
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

    // Broadcast presence
    await broadcastGameStart(userId, game);
  }

  /**
   * Handle game end
   */
  private async handleGameEnd(userId: string, discordId: string): Promise<void> {
    // Close session in database
    const closed = await closeSession(userId);

    // Remove from local tracking
    this.activeSessions.delete(discordId);

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
      // Create it now
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
    if (sessions.length === 0) return;

    logger.info('Closing all active sessions for shutdown', { count: sessions.length });

    for (const session of sessions) {
      try {
        await closeSession(session.userId);
        logger.info('Session closed on shutdown', {
          userId: session.userId,
          gameName: session.gameName,
        });
      } catch (error) {
        logger.error('Failed to close session on shutdown', error, {
          userId: session.userId,
          gameName: session.gameName,
        });
      }
    }

    // Clear pending end timers
    for (const [discordId, timer] of this.pendingEnds) {
      clearTimeout(timer);
    }
    this.pendingEnds.clear();
    this.activeSessions.clear();
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
      logger.error('Failed to fetch open sessions for reconciliation', error);
      return;
    }

    if (openSessions.length === 0) return;

    logger.info('Reconciling open sessions on startup', { count: openSessions.length });

    for (const session of openSessions) {
      // Find the discord ID for this user
      const discordId = userCache.getAllDiscordIds().find(
        (did) => userCache.getUserId(did) === session.user_id
      );

      if (!discordId) {
        // User not in cache, close the orphaned session
        await closeSession(session.user_id);
        logger.info('Closed orphaned session (user not in cache)', {
          userId: session.user_id,
          gameName: session.game_name,
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
        logger.info('Adopted existing session', {
          userId: session.user_id,
          gameName: session.game_name,
          sessionId: session.id,
        });
      } else {
        // User stopped playing or switched games — close the old session
        await closeSession(session.user_id);
        logger.info('Closed stale session on startup', {
          userId: session.user_id,
          gameName: session.game_name,
          currentGame: currentGame?.name ?? null,
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
}

// Singleton instance
export const sessionTracker = new SessionTracker();
