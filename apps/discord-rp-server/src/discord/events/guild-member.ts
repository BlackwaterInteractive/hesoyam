import type { GuildMember, PartialGuildMember } from 'discord.js';
import { syncGuildMembership } from '../../services/guild-sync.js';
import { logger } from '../../utils/logger.js';

/**
 * Handle a member joining the guild.
 * Re-syncs in_guild for all tracked users so newly signed-up users get caught.
 */
export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  logger.info('Member joined guild, running membership sync', { discordId: member.id });
  await syncGuildMembership(member.guild);
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
