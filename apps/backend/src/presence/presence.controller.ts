import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireApiKey } from '../auth/decorators/api-key.decorator';
import { PresenceService } from './presence.service';
import { PresenceBroadcastDto } from './dto/presence-broadcast.dto';

@ApiTags('Presence')
@Controller('presence')
@RequireApiKey()
export class PresenceController {
  constructor(private presence: PresenceService) {}

  @Post('broadcast')
  @ApiOperation({
    summary: 'Broadcast a live presence event',
    description: `**Called by:** Discord bot only.

Publishes a \`game_presence\` event on the Supabase Realtime channel \`presence:{user_id}\`. The mobile app subscribes to this channel to render the live-session card (pulsing glow + ticking timer).

**Event semantics:**
- \`start\` — game just began; include \`game_name\`, \`cover_url\`, \`started_at\`.
- \`heartbeat\` — every 30 seconds while playing; same payload as \`start\`.
- \`end\` — game closed; all game fields should be \`null\`.`,
  })
  broadcast(@Body() payload: PresenceBroadcastDto) {
    return this.presence.broadcast(payload.user_id, payload);
  }
}
