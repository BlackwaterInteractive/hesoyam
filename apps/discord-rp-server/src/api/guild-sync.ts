import { getApiClient } from './client.js';
import { logger } from '../utils/logger.js';

interface SyncResult {
  synced: number;
}

/**
 * Sync guild membership via the backend API.
 * Marks provided members as in_guild=true, all others as in_guild=false.
 */
export async function syncGuildMembership(
  members: { discordId: string }[],
): Promise<void> {
  try {
    const api = getApiClient();
    const result = await api.post<SyncResult>('/discord/guild-sync', { members });
    logger.info('[API] Guild membership synced', { synced: result.synced, memberCount: members.length });
  } catch (err) {
    logger.error('[API] Guild sync failed', err as Error, { memberCount: members.length });
  }
}
