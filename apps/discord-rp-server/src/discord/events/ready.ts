import type { Client } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { userCache } from '../../services/user-cache.js';
import { sessionTracker } from '../../services/session-tracker.js';
import { env } from '../../config/env.js';
import { syncGuildMembership } from '../../services/guild-sync.js';
import { extractGameActivity, type GameActivity } from '../../types/index.js';

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

  // Reconcile open DB sessions with current presences
  const currentPresences = getCurrentPresences(client);
  await sessionTracker.reconcileOnStartup(currentPresences);

  // Log initial presence data
  logInitialPresenceStats(client);

  // Start periodic status heartbeat (every 60s) to track bot health
  setInterval(() => {
    const activeSessions = sessionTracker.getActiveSessions();
    logger.info('[HEARTBEAT] Bot status', {
      uptime: Math.floor(process.uptime()),
      activeSessions: activeSessions.length,
      sessions: activeSessions.map((s) => ({
        discordId: s.discordId,
        gameName: s.gameName,
        sessionId: s.id,
        startedAt: s.startedAt.toISOString(),
        durationSecs: Math.floor((Date.now() - s.startedAt.getTime()) / 1000),
        lastUpdate: s.lastUpdate.toISOString(),
        lastUpdateAgoSecs: Math.floor((Date.now() - s.lastUpdate.getTime()) / 1000),
      })),
      wsStatus: client.ws.status,
      wsPing: client.ws.ping,
      timestamp: new Date().toISOString(),
    });
  }, 60_000);

  logger.success('Discord RP Server is ready!');
  logConnectionInstructions();
}

/**
 * Build a map of Discord ID -> GameActivity for all currently playing monitored users
 */
function getCurrentPresences(client: Client<true>): Map<string, GameActivity> {
  const presences = new Map<string, GameActivity>();
  const monitoredIds = new Set(userCache.getAllDiscordIds());

  client.guilds.cache.forEach((guild) => {
    guild.presences.cache.forEach((presence) => {
      if (!monitoredIds.has(presence.userId)) return;

      const playingActivity = presence.activities.find((a) => a.type === 0);
      if (!playingActivity) return;

      const game = extractGameActivity(playingActivity);
      if (game) {
        presences.set(presence.userId, game);
      }
    });
  });

  return presences;
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
