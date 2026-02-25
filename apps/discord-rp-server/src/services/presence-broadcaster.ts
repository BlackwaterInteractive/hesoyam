import { getSupabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameActivity, PresenceBroadcastPayload } from '../types/index.js';
import { slugify } from '../types/index.js';

// Cache of subscribed channels per userId
const channels = new Map<string, RealtimeChannel>();

/**
 * Get or create a subscribed channel for a user.
 * Channels must be subscribed before sending broadcasts via WebSocket.
 */
async function getChannel(userId: string): Promise<RealtimeChannel> {
  const existing = channels.get(userId);
  if (existing) return existing;

  const supabase = getSupabase();
  const channel = supabase.channel(`presence:${userId}`);

  return new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channels.set(userId, channel);
        logger.debug('[BROADCAST] Channel subscribed', {
          userId,
          channel: `presence:${userId}`,
        });
        resolve(channel);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logger.error('[BROADCAST] Channel subscription failed', undefined, {
          userId,
          status,
        });
        reject(new Error(`Channel subscription failed: ${status}`));
      }
    });
  });
}

/**
 * Broadcast presence updates to Supabase Realtime channels
 */
export async function broadcastPresence(
  userId: string,
  game: GameActivity | null,
  event: 'start' | 'end' | 'heartbeat'
): Promise<void> {
  const payload: PresenceBroadcastPayload = {
    user_id: userId,
    event,
    game_name: game?.name ?? null,
    game_slug: game?.name ? slugify(game.name) : null,
    cover_url: game?.largeImageUrl ?? null,
    started_at: game?.startedAt?.toISOString() ?? null,
  };

  try {
    const channel = await getChannel(userId);

    logger.debug('[BROADCAST] Sending presence broadcast', {
      userId,
      event,
      gameName: payload.game_name,
      channel: `presence:${userId}`,
    });

    await channel.send({
      type: 'broadcast',
      event: 'game_presence',
      payload,
    });

    logger.presence(userId, game?.name ?? null, event);
    logger.debug('[BROADCAST] Presence broadcast sent successfully', {
      userId,
      event,
    });
  } catch (error) {
    // If channel failed, remove from cache so next attempt creates a fresh one
    channels.delete(userId);
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
