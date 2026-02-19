import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { handleReady } from './events/ready.js';
import { handlePresenceUpdate } from './events/presence-update.js';
import { handleGuildMemberAdd, handleGuildMemberRemove } from './events/guild-member.js';

let discordClient: Client | null = null;

/**
 * Create and configure the Discord client
 */
export function createDiscordClient(): Client {
  if (discordClient) {
    return discordClient;
  }

  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.GuildMember],
  });

  // Register event handlers
  discordClient.once('ready', handleReady);
  discordClient.on('presenceUpdate', handlePresenceUpdate);
  discordClient.on('guildMemberAdd', handleGuildMemberAdd);
  discordClient.on('guildMemberRemove', handleGuildMemberRemove);

  // Error handling
  discordClient.on('error', (error) => {
    logger.error('Discord client error', error);
  });

  discordClient.on('warn', (warning) => {
    logger.warn('Discord client warning', { warning });
  });

  // Shard lifecycle events — critical for diagnosing session issues
  discordClient.on('shardDisconnect', (event, shardId) => {
    logger.warn('[SHARD] DISCONNECTED', {
      shardId,
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      timestamp: new Date().toISOString(),
    });
  });

  discordClient.on('shardReconnecting', (shardId) => {
    logger.warn('[SHARD] RECONNECTING', {
      shardId,
      timestamp: new Date().toISOString(),
    });
  });

  discordClient.on('shardResume', (shardId, replayedEvents) => {
    logger.info('[SHARD] RESUMED', {
      shardId,
      replayedEvents,
      timestamp: new Date().toISOString(),
    });
  });

  discordClient.on('shardReady', (shardId, unavailableGuilds) => {
    logger.info('[SHARD] READY (full reconnect)', {
      shardId,
      unavailableGuilds: unavailableGuilds?.size ?? 0,
      timestamp: new Date().toISOString(),
    });
  });

  discordClient.on('shardError', (error, shardId) => {
    logger.error('[SHARD] ERROR', error, {
      shardId,
      timestamp: new Date().toISOString(),
    });
  });

  // Invalidated session — bot must do a full reconnect
  discordClient.on('invalidated', () => {
    logger.error('[SHARD] SESSION INVALIDATED — full reconnect required', undefined, {
      timestamp: new Date().toISOString(),
    });
  });

  return discordClient;
}

/**
 * Get the Discord client instance
 */
export function getDiscordClient(): Client {
  if (!discordClient) {
    throw new Error('Discord client not initialized. Call createDiscordClient() first.');
  }
  return discordClient;
}

/**
 * Connect to Discord
 */
export async function connectToDiscord(): Promise<void> {
  const client = createDiscordClient();

  try {
    await client.login(env.discordBotToken);
  } catch (error) {
    logger.error('Failed to connect to Discord', error);
    throw error;
  }
}

/**
 * Disconnect from Discord
 */
export async function disconnectFromDiscord(): Promise<void> {
  if (discordClient) {
    await discordClient.destroy();
    discordClient = null;
    logger.info('Discord client disconnected');
  }
}

/**
 * Check if connected to Discord
 */
export function isConnected(): boolean {
  return discordClient?.isReady() ?? false;
}
