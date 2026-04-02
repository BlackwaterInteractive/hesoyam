import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../core/supabase/supabase.service';
import { TwitchAuthService } from '../igdb/twitch-auth.service';

@Controller('health')
export class HealthController {
  constructor(
    private supabase: SupabaseService,
    private twitchAuth: TwitchAuthService,
  ) {}

  @Get()
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async readiness() {
    const checks = await Promise.allSettled([
      this.supabase
        .getClient()
        .from('profiles')
        .select('id')
        .limit(1),
      this.twitchAuth.getAccessToken(),
    ]);

    const allHealthy = checks.every((c) => c.status === 'fulfilled');

    return {
      status: allHealthy ? 'ok' : 'degraded',
      checks: {
        database: checks[0].status,
        igdb: checks[1].status,
      },
    };
  }
}
