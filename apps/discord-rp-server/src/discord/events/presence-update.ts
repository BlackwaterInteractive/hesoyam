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

  // Log raw presence data for debugging
  const oldActivities = oldPresence?.activities.map((a) => ({
    name: a.name,
    type: a.type,
    details: a.details,
    state: a.state,
    timestamps: a.timestamps,
  })) ?? [];
  const newActivities = newPresence.activities.map((a) => ({
    name: a.name,
    type: a.type,
    details: a.details,
    state: a.state,
    timestamps: a.timestamps,
  }));

  logger.info('Raw presence update', {
    discordId,
    oldStatus: oldPresence?.status ?? null,
    newStatus: newPresence.status,
    oldActivities,
    newActivities,
  });

  // Extract game activities
  const oldGame = extractPlayingActivity(oldPresence);
  const newGame = extractPlayingActivity(newPresence);

  // Skip if nothing changed
  if (isSameGame(oldGame, newGame)) {
    return;
  }

  // Log the change with full detail
  logger.info('Presence change detected', {
    discordId,
    oldGame: oldGame ? { name: oldGame.name, details: oldGame.details, state: oldGame.state, startedAt: oldGame.startedAt?.toISOString() ?? null } : null,
    newGame: newGame ? { name: newGame.name, details: newGame.details, state: newGame.state, startedAt: newGame.startedAt?.toISOString() ?? null } : null,
    oldStatus: oldPresence?.status ?? null,
    newStatus: newPresence.status,
    oldActivityCount: oldActivities.length,
    newActivityCount: newActivities.length,
  });

  // Handle the game change
  try {
    await sessionTracker.handleGameChange(discordId, oldGame, newGame);
  } catch (error) {
    logger.error('Error handling presence update', error, { discordId });
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
