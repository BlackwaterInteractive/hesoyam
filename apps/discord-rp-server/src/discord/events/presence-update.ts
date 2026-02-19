import type { Presence } from 'discord.js';
import { userCache } from '../../services/user-cache.js';
import { sessionTracker } from '../../services/session-tracker.js';
import { logger } from '../../utils/logger.js';
import { extractGameActivity, type GameActivity } from '../../types/index.js';

/**
 * Handle Discord presence update event
 */
export async function handlePresenceUpdate(
  oldPresence: Presence | null,
  newPresence: Presence
): Promise<void> {
  // Ignore if no user ID
  if (!newPresence.userId) return;

  const discordId = newPresence.userId;

  // Check if this user is being monitored
  if (!userCache.has(discordId)) {
    return; // Not a Hesoyam user
  }

  // Log ALL raw activities from Discord for full visibility
  const oldActivities = oldPresence?.activities.map((a) => ({
    name: a.name,
    type: a.type,
    details: a.details,
    state: a.state,
    timestamps: a.timestamps ? {
      start: a.timestamps.start?.toISOString() ?? null,
      end: a.timestamps.end?.toISOString() ?? null,
    } : null,
    applicationId: a.applicationId,
  })) ?? [];

  const newActivities = newPresence.activities.map((a) => ({
    name: a.name,
    type: a.type,
    details: a.details,
    state: a.state,
    timestamps: a.timestamps ? {
      start: a.timestamps.start?.toISOString() ?? null,
      end: a.timestamps.end?.toISOString() ?? null,
    } : null,
    applicationId: a.applicationId,
  }));

  // Extract game activities
  const oldGame = extractPlayingActivity(oldPresence);
  const newGame = extractPlayingActivity(newPresence);

  const gameChanged = !isSameGame(oldGame, newGame);

  // Flag if oldPresence is null — indicates a possible gateway reconnect
  const isOldPresenceNull = oldPresence === null;

  // Log EVERY presence update for monitored users (not just game changes)
  logger.info('[PRESENCE] Raw update received', {
    discordId,
    oldPresenceNull: isOldPresenceNull,
    oldStatus: oldPresence?.status ?? null,
    newStatus: newPresence.status,
    oldActivityCount: oldActivities.length,
    newActivityCount: newActivities.length,
    oldActivities: JSON.stringify(oldActivities),
    newActivities: JSON.stringify(newActivities),
    oldGame: oldGame?.name ?? null,
    newGame: newGame?.name ?? null,
    gameChanged,
    hasActiveSession: sessionTracker.hasActiveSession(discordId),
    timestamp: new Date().toISOString(),
  });

  // Warn loudly if old presence is null and we have an active session — gateway reconnect scenario
  if (isOldPresenceNull && sessionTracker.hasActiveSession(discordId)) {
    logger.warn('[PRESENCE] ⚠️ OLD PRESENCE IS NULL but active session exists — possible gateway reconnect', {
      discordId,
      newGame: newGame?.name ?? null,
      activeSessionGame: sessionTracker.getActiveSessionGame(discordId),
      timestamp: new Date().toISOString(),
    });
  }

  // Skip if nothing changed
  if (!gameChanged) {
    // Log same-game heartbeats at debug level to track that we ARE receiving updates
    if (oldGame && newGame) {
      logger.info('[PRESENCE] Same game heartbeat (skipping handleGameChange)', {
        discordId,
        gameName: newGame.name,
        hasActiveSession: sessionTracker.hasActiveSession(discordId),
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }

  // Determine case
  let changeCase = 'unknown';
  if (!oldGame && newGame) changeCase = 'GAME_START';
  else if (oldGame && !newGame) changeCase = 'GAME_END';
  else if (oldGame && newGame) changeCase = 'GAME_SWITCH';

  logger.info(`[PRESENCE] Game change: ${changeCase}`, {
    discordId,
    oldGame: oldGame ? { name: oldGame.name, startedAt: oldGame.startedAt?.toISOString() ?? null } : null,
    newGame: newGame ? { name: newGame.name, startedAt: newGame.startedAt?.toISOString() ?? null } : null,
    changeCase,
    timestamp: new Date().toISOString(),
  });

  // Handle the game change
  try {
    await sessionTracker.handleGameChange(discordId, oldGame, newGame);
  } catch (error) {
    logger.error('[PRESENCE] Error handling presence update', error, { discordId });
  }
}

/**
 * Extract the "Playing" activity from a presence
 */
function extractPlayingActivity(presence: Presence | null): GameActivity | null {
  if (!presence) return null;

  // Find the first "Playing" activity (type 0)
  const playingActivity = presence.activities.find((a) => a.type === 0);
  if (!playingActivity) return null;

  return extractGameActivity(playingActivity);
}

/**
 * Check if two games are the same
 */
function isSameGame(a: GameActivity | null, b: GameActivity | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.name === b.name;
}
