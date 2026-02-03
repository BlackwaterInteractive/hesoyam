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

/**
 * Tracks active sessions for Discord-monitored users
 */
class SessionTracker {
  // In-memory tracking of active Discord sessions
  // Maps Discord ID -> Active Session info
  private activeSessions: Map<string, ActiveSession> = new Map();

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
      return;
    }

    // Case 1: Game started (no game before, game now)
    if (!oldGame && newGame) {
      await this.handleGameStart(userId, discordId, newGame);
    }
    // Case 2: Game ended (game before, no game now)
    else if (oldGame && !newGame) {
      await this.handleGameEnd(userId, discordId);
    }
    // Case 3: Game switched (different game)
    else if (oldGame && newGame && oldGame.name !== newGame.name) {
      await this.handleGameEnd(userId, discordId);
      await this.handleGameStart(userId, discordId, newGame);
    }
    // Case 4: Same game continues (heartbeat)
    else if (oldGame && newGame && oldGame.name === newGame.name) {
      await this.handleHeartbeat(userId, discordId, newGame);
    }
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
