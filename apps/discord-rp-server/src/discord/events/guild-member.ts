import type { GuildMember, PartialGuildMember } from 'discord.js';
import { syncGuildMembership } from '../../services/guild-sync.js';
import { userCache } from '../../services/user-cache.js';
import { getUserByDiscordId } from '../../supabase/users.js';
import { logger } from '../../utils/logger.js';

/**
 * Handle a member joining the guild.
 * Re-syncs in_guild for all tracked users so newly signed-up users get caught.
 * Also ensures the new member is in the user cache (in case realtime missed the INSERT).
 */
export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  logger.info('Member joined guild, running membership sync', { discordId: member.id });
  await syncGuildMembership(member.guild);

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
 * Re-syncs in_guild for all tracked users.
 */
export async function handleGuildMemberRemove(
  member: GuildMember | PartialGuildMember
): Promise<void> {
  logger.info('Member left guild, running membership sync', { discordId: member.id });
  await syncGuildMembership(member.guild);
}
