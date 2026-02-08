import type { Client } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { userCache } from '../../services/user-cache.js';
import { env } from '../../config/env.js';
import { syncGuildMembership } from '../../services/guild-sync.js';

/**
 * Handle Discord client ready event
 */
export async function handleReady(client: Client<true>): Promise<void> {
  logger.success(`Discord bot logged in as ${client.user.tag}`);
  logger.info('Bot stats', {
    guilds: client.guilds.cache.size,
    users: client.users.cache.size,
  });

  // Verify bot is in the configured Hesoyam guild
  const hesoyamGuild = client.guilds.cache.get(env.discordGuildId);
  if (!hesoyamGuild) {
    logger.error('Bot is not in the configured Hesoyam guild', undefined, {
      guildId: env.discordGuildId,
    });
    logger.warn('The bot will not be able to monitor presence for users');
  } else {
    logger.info('Connected to Hesoyam guild', {
      name: hesoyamGuild.name,
      memberCount: hesoyamGuild.memberCount,
    });
  }

  // Initialize user cache
  await userCache.initialize();

  // Subscribe to real-time updates for new Discord connections
  userCache.subscribeToUpdates();

  // Sync guild membership status for all tracked users
  if (hesoyamGuild) {
    await syncGuildMembership(hesoyamGuild);
  }

  // Log initial presence data
  logInitialPresenceStats(client);

  logger.success('Discord RP Server is ready!');
  logConnectionInstructions();
}

/**
 * Log initial presence statistics
 */
function logInitialPresenceStats(client: Client<true>): void {
  let playingCount = 0;
  let trackedPlayingCount = 0;

  const monitoredIds = new Set(userCache.getAllDiscordIds());

  client.guilds.cache.forEach((guild) => {
    guild.presences.cache.forEach((presence) => {
      const isPlaying = presence.activities.some((a) => a.type === 0);
      if (isPlaying) {
        playingCount++;
        if (monitoredIds.has(presence.userId)) {
          trackedPlayingCount++;
        }
      }
    });
  });

  logger.info('Initial presence stats', {
    monitoredUsers: userCache.size,
    usersPlaying: playingCount,
    trackedUsersPlaying: trackedPlayingCount,
  });
}

/**
 * Log connection instructions
 */
function logConnectionInstructions(): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Hesoyam Discord RP Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Monitoring: ${userCache.size} connected users`);
  console.log(`  Guild ID: ${env.discordGuildId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
