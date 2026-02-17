import type { Guild } from 'discord.js';
import { getSupabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';

/**
 * Sync guild membership status for all profiles with a discord_id.
 * Queries the DB directly (no cache dependency) and cross-references
 * with actual guild members to bulk-update in_guild.
 */
export async function syncGuildMembership(guild: Guild): Promise<void> {
  try {
    const supabase = getSupabase();

    // Get all profiles that have a discord_id
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id, discord_id')
      .not('discord_id', 'is', null);

    if (fetchError) {
      logger.error('Failed to fetch profiles for guild sync', fetchError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      logger.info('No profiles with discord_id to sync');
      return;
    }

    // Fetch all guild members
    const members = await guild.members.fetch();
    const guildMemberIds = new Set(members.map((m) => m.id));

    const inGuildIds: string[] = [];
    const notInGuildIds: string[] = [];

    for (const profile of profiles) {
      if (guildMemberIds.has(profile.discord_id)) {
        inGuildIds.push(profile.id);
      } else {
        notInGuildIds.push(profile.id);
      }
    }

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
