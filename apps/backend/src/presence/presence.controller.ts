import { Body, Controller, Post } from '@nestjs/common';
import { RequireApiKey } from '../auth/decorators/api-key.decorator';
import { PresenceService } from './presence.service';
import type { PresenceBroadcastPayload } from './presence.service';

@Controller('presence')
@RequireApiKey()
export class PresenceController {
  constructor(private presence: PresenceService) {}

  @Post('broadcast')
  broadcast(@Body() payload: PresenceBroadcastPayload) {
    return this.presence.broadcast(payload.user_id, payload);
  }
}
