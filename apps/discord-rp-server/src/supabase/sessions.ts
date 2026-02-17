import { getSupabase } from './client.js';
import { logger } from '../utils/logger.js';
import { resolveGame } from '../services/game-resolver.js';
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
 * Try to reopen a recently closed session for the same game launch.
 * Returns the reopened session if found, otherwise null.
 *
 * Detects same launch by comparing Discord's timestamps.start (the actual
 * game launch time) against the last closed session's started_at.
 * If discord_start <= last_session.started_at, it's the same game launch
 * (user just toggled presence off/on).
 */
async function tryReopenSession(
  userId: string,
  gameName: string,
  discordStart: Date | null
): Promise<GameSessionRow | null> {
  if (!discordStart) return null;

  const supabase = getSupabase();

  // Find the most recently closed Discord session for this user + game
  const { data: lastSession, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('game_name', gameName)
    .eq('source', 'discord')
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !lastSession) return null;

  const lastStartedAt = new Date(lastSession.started_at);

  // If Discord's start time is at or before the previous session's start,
  // it's the same game launch — user toggled presence, not a new session
  if (discordStart.getTime() <= lastStartedAt.getTime()) {
    // Roll back user_games stats that were added when this session was closed
    if (lastSession.game_id && lastSession.duration_secs > 0) {
      await supabase.rpc('rollback_user_game_stats', {
        p_user_id: userId,
        p_game_id: lastSession.game_id,
        p_duration_secs: lastSession.duration_secs,
      });
    }

    const { data: reopened, error: reopenError } = await supabase
      .from('game_sessions')
      .update({
        ended_at: null,
        duration_secs: 0,
        active_secs: 0,
        idle_secs: 0,
      })
      .eq('id', lastSession.id)
      .select()
      .single();

    if (reopenError) {
      logger.error('Failed to reopen session', reopenError, {
        userId,
        sessionId: lastSession.id,
      });
      return null;
    }

    logger.info('Session reopened (same game launch detected)', {
      userId,
      gameName,
      sessionId: lastSession.id,
      discordStart: discordStart.toISOString(),
      originalStart: lastSession.started_at,
    });
    return reopened as GameSessionRow;
  }

  return null;
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

  // Check if this is a reopenable session (same game launch, toggled presence)
  const reopened = await tryReopenSession(userId, game.name, game.startedAt);
  if (reopened) {
    return reopened;
  }

  // Resolve game name to a game record in our DB (fuzzy match → IGDB → minimal)
  let gameId: string | null = null;
  try {
    const resolved = await resolveGame(game.name);
    gameId = resolved.id;
    logger.info('Game resolved for session', {
      gameName: game.name,
      resolvedName: resolved.name,
      gameId: resolved.id,
    });
  } catch (error) {
    logger.error('Game resolution failed, creating session without game_id', error, {
      userId,
      gameName: game.name,
    });
  }

  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      user_id: userId,
      game_id: gameId,
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

  logger.info('Session created', { userId, gameName: game.name, gameId, sessionId: data.id });
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
