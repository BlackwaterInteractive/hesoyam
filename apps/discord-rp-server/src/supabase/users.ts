import { getSupabase } from './client.js';
import { logger } from '../utils/logger.js';
import type { ProfileRow, MonitoredUser, GameSessionRow } from '../types/index.js';

/**
 * Fetch all users who have connected their Discord account
 */
export async function fetchConnectedUsers(): Promise<MonitoredUser[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, discord_id, agent_last_seen')
    .not('discord_id', 'is', null);

  if (error) {
    logger.error('Failed to fetch connected users', error);
    return [];
  }

  return (data as ProfileRow[]).map((row) => ({
    id: row.id,
    discordId: row.discord_id!,
    agentLastSeen: row.agent_last_seen ? new Date(row.agent_last_seen) : null,
  }));
}

/**
 * Check if a user's agent is currently active
 */
export async function isAgentActive(userId: string, timeoutMs: number): Promise<boolean> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('profiles')
    .select('agent_last_seen')
    .eq('id', userId)
    .single();

  if (error || !data?.agent_last_seen) {
    return false;
  }

  const lastSeen = new Date(data.agent_last_seen);
  const threshold = new Date(Date.now() - timeoutMs);

  return lastSeen > threshold;
}

/**
 * Get a user by their Discord ID
 */
export async function getUserByDiscordId(discordId: string): Promise<MonitoredUser | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, discord_id, agent_last_seen')
    .eq('discord_id', discordId)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as ProfileRow;
  return {
    id: row.id,
    discordId: row.discord_id!,
    agentLastSeen: row.agent_last_seen ? new Date(row.agent_last_seen) : null,
  };
}

/**
 * Check if a user's active session is owned by the agent (not Discord).
 * Read-only check used to avoid conflicting with agent tracking.
 */
export async function isSessionOwnedByAgent(userId: string): Promise<boolean> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, source')
    .eq('user_id', userId)
    .is('ended_at', null)
    .single();

  if (error || !data) return false;

  const result = (data as GameSessionRow).source === 'agent';
  if (result) {
    logger.info('[DB] isSessionOwnedByAgent: YES', {
      userId,
      sessionId: data.id,
      source: (data as GameSessionRow).source,
    });
  }
  return result;
}
