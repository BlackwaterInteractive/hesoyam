import { getApiClient } from './client.js';
import { logger } from '../utils/logger.js';
import type { PresenceBroadcastPayload } from '../types/index.js';

/**
 * Broadcast a presence event via the backend API.
 * Fire-and-forget — errors are logged but not thrown.
 */
async function broadcastPresence(payload: PresenceBroadcastPayload): Promise<void> {
  try {
    const api = getApiClient();
    await api.post('/presence/broadcast', payload);
  } catch (err) {
    logger.warn('[API] Presence broadcast failed', { err, userId: payload.user_id, event: payload.event });
  }
}

export async function broadcastGameStart(
  userId: string,
  game: { name: string; slug: string; cover_url: string | null; started_at: string },
): Promise<void> {
  await broadcastPresence({
    user_id: userId,
    event: 'start',
    game_name: game.name,
    game_slug: game.slug,
    cover_url: game.cover_url,
    started_at: game.started_at,
  });
}

export async function broadcastGameEnd(userId: string): Promise<void> {
  await broadcastPresence({
    user_id: userId,
    event: 'end',
    game_name: null,
    game_slug: null,
    cover_url: null,
    started_at: null,
  });
}

export async function broadcastHeartbeat(
  userId: string,
  game: { name: string; slug: string; cover_url: string | null; started_at: string },
): Promise<void> {
  await broadcastPresence({
    user_id: userId,
    event: 'heartbeat',
    game_name: game.name,
    game_slug: game.slug,
    cover_url: game.cover_url,
    started_at: game.started_at,
  });
}
