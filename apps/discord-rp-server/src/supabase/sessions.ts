import { getSupabase } from './client.js';
import { logger } from '../utils/logger.js';
import type { GameSessionRow, GameActivity } from '../types/index.js';
import { slugify } from '../types/index.js';

/**
 * Get the active session for a user (if any)
 */
export async function getActiveSession(userId: string): Promise<GameSessionRow | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .single();

  if (error) {
    // No active session is not an error
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to get active session', error, { userId });
    return null;
  }

  return data as GameSessionRow;
}

/**
 * Create a new gaming session
 */
export async function createSession(
  userId: string,
  game: GameActivity
): Promise<GameSessionRow | null> {
  const supabase = getSupabase();

  // First, close any existing session
  await closeSession(userId);

  const startedAt = game.startedAt ?? new Date();

  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      user_id: userId,
      game_name: game.name,
      started_at: startedAt.toISOString(),
      source: 'discord',
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create session', error, { userId, gameName: game.name });
    return null;
  }

  logger.info('Session created', { userId, gameName: game.name, sessionId: data.id });
  return data as GameSessionRow;
}

/**
 * Close the active session for a user
 */
export async function closeSession(userId: string): Promise<boolean> {
  const supabase = getSupabase();

  // Get the active session
  const activeSession = await getActiveSession(userId);
  if (!activeSession) {
    return false;
  }

  // Only close if we own this session (source = 'discord')
  if (activeSession.source !== 'discord') {
    logger.debug('Skipping close - session owned by agent', { userId, sessionId: activeSession.id });
    return false;
  }

  const now = new Date();
  const startedAt = new Date(activeSession.started_at);
  const durationSecs = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

  const { error } = await supabase
    .from('game_sessions')
    .update({
      ended_at: now.toISOString(),
      duration_secs: durationSecs,
      active_secs: durationSecs, // No idle detection for Discord
      idle_secs: 0,
    })
    .eq('id', activeSession.id);

  if (error) {
    logger.error('Failed to close session', error, { userId, sessionId: activeSession.id });
    return false;
  }

  logger.info('Session closed', {
    userId,
    gameName: activeSession.game_name,
    durationSecs,
    sessionId: activeSession.id,
  });
  return true;
}

/**
 * Check if a session is owned by the agent (not Discord)
 */
export async function isSessionOwnedByAgent(userId: string): Promise<boolean> {
  const session = await getActiveSession(userId);
  return session?.source === 'agent';
}
