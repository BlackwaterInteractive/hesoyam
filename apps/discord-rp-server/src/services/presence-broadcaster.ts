import { getSupabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';
import type { PresenceBroadcastPayload } from '../types/index.js';

/**
 * Resolved game data passed to broadcast functions.
 * Contains IGDB-sourced cover_url and slug (not Discord activity images).
 */
export interface BroadcastGameData {
  gameId: string | null;
  gameName: string;
  gameSlug: string;
  coverUrl: string | null;
  startedAt: Date;
}

/**
 * Broadcast presence updates via Supabase Realtime HTTP broadcast.
 * Uses httpSend() instead of WebSocket channel.send() — no subscription needed.
 * This bypasses GCP e2-micro's broken WebSocket data frame handling.
 */
async function broadcastPresence(
  userId: string,
  game: BroadcastGameData | null,
  event: 'start' | 'end' | 'heartbeat'
): Promise<void> {
  const payload: PresenceBroadcastPayload = {
    user_id: userId,
    event,
    game_name: game?.gameName ?? null,
    game_slug: game?.gameSlug ?? null,
    cover_url: game?.coverUrl ?? null,
    started_at: game?.startedAt?.toISOString() ?? null,
  };

  try {
    const supabase = getSupabase();
    const channel = supabase.channel(`presence:${userId}`);

    logger.debug('[BROADCAST] Sending presence broadcast via HTTP', {
      userId,
      event,
      gameName: payload.game_name,
      coverUrl: payload.cover_url,
      channel: `presence:${userId}`,
    });

    await channel.httpSend('game_presence', payload);

    logger.presence(userId, game?.gameName ?? null, event);
    logger.debug('[BROADCAST] Presence broadcast sent successfully via HTTP', {
      userId,
      event,
    });
  } catch (error) {
    logger.error('Failed to broadcast presence', error, { userId, event });
  }
}

/**
 * Broadcast game start event
 */
export async function broadcastGameStart(userId: string, game: BroadcastGameData): Promise<void> {
  await broadcastPresence(userId, game, 'start');
}

/**
 * Broadcast game end event
 */
export async function broadcastGameEnd(userId: string): Promise<void> {
  await broadcastPresence(userId, null, 'end');
}

/**
 * Broadcast heartbeat for active game
 */
export async function broadcastHeartbeat(userId: string, game: BroadcastGameData): Promise<void> {
  await broadcastPresence(userId, game, 'heartbeat');
}
