import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseService } from '../core/supabase/supabase.service';
import { TwitchAuthService } from '../igdb/twitch-auth.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private supabase: SupabaseService,
    private twitchAuth: TwitchAuthService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness probe',
    description: `**Called by:** Northflank orchestration, external uptime monitors.

Returns \`200\` whenever the Node process is up. Does not check downstream dependencies — intended only to detect hung or crashed processes.`,
  })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: `**Called by:** Northflank orchestration before routing traffic to a new instance.

Verifies that downstream dependencies (Supabase, IGDB/Twitch OAuth) are reachable. Returns \`status: "ok"\` when all checks succeed, \`status: "degraded"\` when any fail.`,
  })
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
