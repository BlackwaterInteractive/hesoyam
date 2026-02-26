import type { Activity } from 'discord.js';

/**
 * Represents a user being monitored for presence updates
 */
export interface MonitoredUser {
  id: string;           // Hesoyam user ID (UUID)
  discordId: string;    // Discord user ID
  agentLastSeen: Date | null;
}

/**
 * Represents an active gaming session being tracked
 */
export interface ActiveSession {
  id: string;           // Session ID from database
  userId: string;       // Hesoyam user ID
  discordId: string;    // Discord user ID
  gameName: string;
  gameId: string | null;
  gameSlug: string;
  coverUrl: string | null;
  startedAt: Date;
  lastUpdate: Date;
  lastBroadcast: number; // Timestamp (ms) of last heartbeat broadcast
}

/**
 * Game activity extracted from Discord presence
 */
export interface GameActivity {
  name: string;
  applicationId: string | null;
  details: string | null;
  state: string | null;
  startedAt: Date | null;
  largeImageUrl: string | null;
  smallImageUrl: string | null;
}

/**
 * Resolved game data from the database (IGDB cover, slug, etc.)
 */
export interface ResolvedGameData {
  id: string | null;
  name: string;
  slug: string;
  cover_url: string | null;
}

/**
 * Presence broadcast event payload
 */
export interface PresenceBroadcastPayload {
  user_id: string;
  event: 'start' | 'end' | 'heartbeat';
  game_name: string | null;
  game_slug: string | null;
  cover_url: string | null;
  started_at: string | null;
}

/**
 * Database profile row
 */
export interface ProfileRow {
  id: string;
  discord_id: string | null;
  agent_last_seen: string | null;
}

/**
 * Database game session row
 */
export interface GameSessionRow {
  id: string;
  user_id: string;
  game_id: string | null;
  game_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
  active_secs: number | null;
  idle_secs: number | null;
  source: 'agent' | 'discord';
}

/**
 * Extract game activity from Discord Activity
 */
export function extractGameActivity(activity: Activity): GameActivity | null {
  // Type 0 = Playing
  if (activity.type !== 0) return null;

  return {
    name: activity.name,
    applicationId: activity.applicationId,
    details: activity.details,
    state: activity.state,
    startedAt: activity.timestamps?.start ? new Date(activity.timestamps.start) : null,
    largeImageUrl: activity.assets?.largeImageURL() ?? null,
    smallImageUrl: activity.assets?.smallImageURL() ?? null,
  };
}

/**
 * Generate a URL-friendly slug from a game name
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
