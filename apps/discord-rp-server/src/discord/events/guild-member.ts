import type { GuildMember, PartialGuildMember } from 'discord.js';
import { getSupabase } from '../../supabase/client.js';
import { userCache } from '../../services/user-cache.js';
import { getUserByDiscordId } from '../../supabase/users.js';
import { logger } from '../../utils/logger.js';

/**
 * Handle a member joining the guild.
 * Updates in_guild directly via Supabase for this member.
 * Also ensures the new member is in the user cache.
 *
 * TODO: Add POST /discord/member-update API endpoint for individual member
 * updates instead of direct Supabase write. The bulk /discord/guild-sync
 * endpoint can't be used here — it would unflag all other members.
 */
export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  logger.info('Member joined guild', { discordId: member.id });

  const supabase = getSupabase();

  // Set in_guild = true for this specific discord_id
  const { error } = await supabase
    .from('profiles')
    .update({ in_guild: true })
    .eq('discord_id', member.id);

  if (error) {
    logger.error('Failed to set in_guild=true for new member', error, {
      discordId: member.id,
    });
  } else {
    logger.info('Set in_guild=true for member', { discordId: member.id });
  }

  // Ensure this member is in the user cache if they have a Hesoyam profile
  if (!userCache.has(member.id)) {
    const user = await getUserByDiscordId(member.id);
    if (user) {
      userCache.addUser(user);
      logger.info('Added new guild member to user cache', {
        discordId: member.id,
        userId: user.id,
      });
    }
  }
}

/**
 * Handle a member leaving the guild.
 * Updates in_guild directly via Supabase for this member.
 *
 * TODO: Move to API endpoint (same as handleGuildMemberAdd above).
 */
export async function handleGuildMemberRemove(
  member: GuildMember | PartialGuildMember
): Promise<void> {
  logger.info('Member left guild', { discordId: member.id });

  const supabase = getSupabase();

  // Set in_guild = false for this specific discord_id
  const { error } = await supabase
    .from('profiles')
    .update({ in_guild: false })
    .eq('discord_id', member.id);

  if (error) {
    logger.error('Failed to set in_guild=false for departed member', error, {
      discordId: member.id,
    });
  } else {
    logger.info('Set in_guild=false for member', { discordId: member.id });
  }
}
