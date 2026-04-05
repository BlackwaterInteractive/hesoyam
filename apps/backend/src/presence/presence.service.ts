import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../core/supabase/supabase.service';

export interface PresenceBroadcastPayload {
  user_id: string;
  event: 'start' | 'end' | 'heartbeat';
  game_name: string | null;
  game_slug: string | null;
  cover_url: string | null;
  started_at: string | null;
}

@Injectable()
export class PresenceService {
  constructor(
    private supabase: SupabaseService,
    @InjectPinoLogger(PresenceService.name) private logger: PinoLogger,
  ) {}

  async broadcast(
    userId: string,
    payload: PresenceBroadcastPayload,
  ): Promise<void> {
    try {
      const channel = this.supabase
        .getClient()
        .channel(`presence:${userId}`);

      await channel.send({
        type: 'broadcast',
        event: 'game_presence',
        payload,
      });

      this.logger.debug(
        { userId, event: payload.event, gameName: payload.game_name },
        'Presence broadcast sent',
      );
    } catch (err) {
      // Fire-and-forget — web has 45s staleness fallback
      this.logger.warn({ err, userId }, 'Presence broadcast failed');
    }
  }
}
