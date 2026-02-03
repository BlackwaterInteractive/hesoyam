import { getSupabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';
import type { GameActivity, PresenceBroadcastPayload } from '../types/index.js';
import { slugify } from '../types/index.js';

/**
 * Broadcast presence updates to Supabase Realtime channels
 */
export async function broadcastPresence(
  userId: string,
  game: GameActivity | null,
  event: 'start' | 'end' | 'heartbeat'
): Promise<void> {
  const supabase = getSupabase();

  const payload: PresenceBroadcastPayload = {
    user_id: userId,
    event,
    game_name: game?.name ?? null,
    game_slug: game?.name ? slugify(game.name) : null,
    cover_url: game?.largeImageUrl ?? null,
    started_at: game?.startedAt?.toISOString() ?? null,
  };

  try {
    const channel = supabase.channel(`presence:${userId}`);

    await channel.send({
      type: 'broadcast',
      event: 'game_presence',
      payload,
    });

    logger.presence(userId, game?.name ?? null, event);
  } catch (error) {
    logger.error('Failed to broadcast presence', error, { userId, event });
  }
}

/**
 * Broadcast game start event
 */
export async function broadcastGameStart(userId: string, game: GameActivity): Promise<void> {
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
export async function broadcastHeartbeat(userId: string, game: GameActivity): Promise<void> {
  await broadcastPresence(userId, game, 'heartbeat');
}
