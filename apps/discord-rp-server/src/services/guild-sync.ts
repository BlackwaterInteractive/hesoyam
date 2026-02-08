import type { Guild } from 'discord.js';
import { getSupabase } from '../supabase/client.js';
import { userCache } from './user-cache.js';
import { logger } from '../utils/logger.js';

/**
 * Sync guild membership status for all tracked users on startup.
 * Fetches all guild members and cross-references with the user cache,
 * then bulk-updates in_guild for all profiles with a discord_id.
 */
export async function syncGuildMembership(guild: Guild): Promise<void> {
  const monitoredIds = userCache.getAllDiscordIds();
  if (monitoredIds.length === 0) {
    logger.info('No monitored users to sync guild membership for');
    return;
  }

  try {
    // Fetch all guild members (this may paginate internally for large guilds)
    const members = await guild.members.fetch();
    const guildMemberIds = new Set(members.map((m) => m.id));

    const inGuildIds: string[] = [];
    const notInGuildIds: string[] = [];

    for (const discordId of monitoredIds) {
      const userId = userCache.getUserId(discordId);
      if (!userId) continue;

      if (guildMemberIds.has(discordId)) {
        inGuildIds.push(userId);
      } else {
        notInGuildIds.push(userId);
      }
    }

    const supabase = getSupabase();

    // Bulk update in_guild = true for members in guild
    if (inGuildIds.length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update({ in_guild: true })
        .in('id', inGuildIds);

      if (error) {
        logger.error('Failed to bulk set in_guild=true', error);
      }
    }

    // Bulk update in_guild = false for members not in guild
    if (notInGuildIds.length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update({ in_guild: false })
        .in('id', notInGuildIds);

      if (error) {
        logger.error('Failed to bulk set in_guild=false', error);
      }
    }

    logger.info('Guild membership synced', {
      inGuild: inGuildIds.length,
      notInGuild: notInGuildIds.length,
    });
  } catch (error) {
    logger.error('Failed to sync guild membership', error);
  }
}
