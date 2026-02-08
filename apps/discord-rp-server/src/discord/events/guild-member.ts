import type { GuildMember, PartialGuildMember } from 'discord.js';
import { getSupabase } from '../../supabase/client.js';
import { userCache } from '../../services/user-cache.js';
import { logger } from '../../utils/logger.js';

/**
 * Handle a member joining the guild
 * If they have a linked Hesoyam profile, set in_guild = true
 */
export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  const discordId = member.id;

  // Check if this Discord user has a Hesoyam profile
  if (!userCache.has(discordId)) return;

  const userId = userCache.getUserId(discordId);
  if (!userId) return;

  const supabase = getSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ in_guild: true })
    .eq('id', userId);

  if (error) {
    logger.error('Failed to set in_guild for member join', error, { discordId });
  } else {
    logger.info('Member joined guild, set in_guild=true', { discordId, userId });
  }
}

/**
 * Handle a member leaving the guild
 * If they have a linked Hesoyam profile, set in_guild = false
 */
export async function handleGuildMemberRemove(
  member: GuildMember | PartialGuildMember
): Promise<void> {
  const discordId = member.id;

  // Check if this Discord user has a Hesoyam profile
  if (!userCache.has(discordId)) return;

  const userId = userCache.getUserId(discordId);
  if (!userId) return;

  const supabase = getSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ in_guild: false })
    .eq('id', userId);

  if (error) {
    logger.error('Failed to unset in_guild for member leave', error, { discordId });
  } else {
    logger.info('Member left guild, set in_guild=false', { discordId, userId });
  }
}
