import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../core/supabase/supabase.service';
import { CacheService } from '../core/cache/cache.service';

@Injectable()
export class UsersService {
  constructor(
    private supabase: SupabaseService,
    private cache: CacheService,
    @InjectPinoLogger(UsersService.name) private logger: PinoLogger,
  ) {}

  async getUserIdByDiscordId(discordId: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get<string>('user-discord', discordId);
    if (cached) return cached;

    const { data } = await this.supabase
      .getClient()
      .from('profiles')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    if (data) {
      this.cache.set('user-discord', discordId, data.id);
      return data.id;
    }

    return null;
  }

  async getConnectedUsers() {
    const { data, error } = await this.supabase
      .getClient()
      .from('profiles')
      .select('id, discord_id')
      .not('discord_id', 'is', null);

    if (error) {
      this.logger.error({ error }, 'Failed to fetch connected users');
      throw error;
    }

    return data ?? [];
  }
}
