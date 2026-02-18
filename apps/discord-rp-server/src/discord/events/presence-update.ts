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

  // Extract game activities
  const oldGame = extractPlayingActivity(oldPresence);
  const newGame = extractPlayingActivity(newPresence);

  const gameChanged = !isSameGame(oldGame, newGame);

  // Skip if nothing changed
  if (!gameChanged) return;

  // Determine case
  let changeCase = 'unknown';
  if (!oldGame && newGame) changeCase = 'GAME_START';
  else if (oldGame && !newGame) changeCase = 'GAME_END';
  else if (oldGame && newGame) changeCase = 'GAME_SWITCH';

  logger.info(`[PRESENCE] Game change: ${changeCase}`, {
    discordId,
    oldGame: oldGame?.name ?? null,
    newGame: newGame?.name ?? null,
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
