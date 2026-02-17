import { getSupabase } from '../supabase/client.js';
import { fetchConnectedUsers } from '../supabase/users.js';
import { logger } from '../utils/logger.js';
import type { MonitoredUser } from '../types/index.js';
import { getDiscordClient } from '../discord/client.js';
import { env } from '../config/env.js';

/**
 * In-memory cache of Discord users being monitored
 * Maps Discord ID -> Hesoyam User data
 */
class UserCache {
  private users: Map<string, MonitoredUser> = new Map();
  private initialized = false;

  /**
   * Initialize the cache by loading all connected users from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const users = await fetchConnectedUsers();
    for (const user of users) {
      this.users.set(user.discordId, user);
    }

    this.initialized = true;
    logger.info('User cache initialized', { userCount: this.users.size });
  }

  /**
   * Subscribe to real-time updates for new Discord connections
   */
  subscribeToUpdates(): void {
    const supabase = getSupabase();

    supabase
      .channel('discord-connections')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          const newRow = payload.new as {
            id: string;
            discord_id?: string;
            agent_last_seen?: string;
          };

          // New Discord connection via INSERT or UPDATE (skip if already in cache)
          if (newRow.discord_id && !this.users.has(newRow.discord_id)) {
            const user: MonitoredUser = {
              id: newRow.id,
              discordId: newRow.discord_id,
              agentLastSeen: newRow.agent_last_seen
                ? new Date(newRow.agent_last_seen)
                : null,
            };
            this.users.set(newRow.discord_id, user);
            logger.info('New Discord connection added to cache', {
              discordId: newRow.discord_id,
              userId: newRow.id,
              event: payload.eventType,
            });

            // Check guild membership for the new user
            this.checkGuildMembership(newRow.id, newRow.discord_id);
          }

          // Update agent_last_seen for existing user
          if (newRow.discord_id && this.users.has(newRow.discord_id)) {
            const user = this.users.get(newRow.discord_id)!;
            user.agentLastSeen = newRow.agent_last_seen
              ? new Date(newRow.agent_last_seen)
              : null;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to Discord connection updates');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Failed to subscribe to Discord connection updates');
        }
      });
  }

  /**
   * Get a monitored user by their Discord ID
   */
  get(discordId: string): MonitoredUser | undefined {
    return this.users.get(discordId);
  }

  /**
   * Check if a Discord user is being monitored
   */
  has(discordId: string): boolean {
    return this.users.has(discordId);
  }

  /**
   * Get the Hesoyam user ID for a Discord user
   */
  getUserId(discordId: string): string | undefined {
    return this.users.get(discordId)?.id;
  }

  /**
   * Check if the agent is active for a user (using cached data + timeout)
   */
  isAgentActive(discordId: string, timeoutMs: number): boolean {
    const user = this.users.get(discordId);
    if (!user?.agentLastSeen) return false;

    const threshold = new Date(Date.now() - timeoutMs);
    return user.agentLastSeen > threshold;
  }

  /**
   * Get all monitored Discord IDs
   */
  getAllDiscordIds(): string[] {
    return Array.from(this.users.keys());
  }

  /**
   * Get the total number of monitored users
   */
  get size(): number {
    return this.users.size;
  }

  /**
   * Check if a Discord user is in the guild and update in_guild accordingly
   */
  private async checkGuildMembership(userId: string, discordId: string): Promise<void> {
    try {
      const client = getDiscordClient();
      const guild = client.guilds.cache.get(env.discordGuildId);
      if (!guild) return;

      const isMember = guild.members.cache.has(discordId);

      const supabase = getSupabase();
      await supabase
        .from('profiles')
        .update({ in_guild: isMember })
        .eq('id', userId);

      logger.info('Checked guild membership for new user', {
        discordId,
        inGuild: isMember,
      });
    } catch (error) {
      logger.error('Failed to check guild membership', error, { discordId });
    }
  }
}

// Singleton instance
export const userCache = new UserCache();
