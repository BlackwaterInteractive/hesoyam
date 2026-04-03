import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../core/supabase/supabase.service';

interface GuildMember {
  discordId: string;
}

@Injectable()
export class DiscordService {
  constructor(
    private supabase: SupabaseService,
    @InjectPinoLogger(DiscordService.name) private logger: PinoLogger,
  ) {}

  async syncGuildMembers(members: GuildMember[]) {
    const client = this.supabase.getClient();
    const discordIds = members.map((m) => m.discordId);

    // Mark members as in_guild
    const { error: updateError } = await client
      .from('profiles')
      .update({ in_guild: true })
      .in('discord_id', discordIds);

    if (updateError) {
      this.logger.error({ error: updateError }, 'Failed to update guild members');
      throw updateError;
    }

    // Mark non-members as not in_guild
    const { error: removeError } = await client
      .from('profiles')
      .update({ in_guild: false })
      .not('discord_id', 'in', `(${discordIds.join(',')})`)
      .eq('in_guild', true)
      .not('discord_id', 'is', null);

    if (removeError) {
      this.logger.warn({ error: removeError }, 'Failed to remove non-guild members');
    }

    this.logger.info({ memberCount: discordIds.length }, 'Guild sync complete');
    return { synced: discordIds.length };
  }
}
