import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireApiKey } from '../auth/decorators/api-key.decorator';
import { DiscordService } from './discord.service';
import { GuildSyncDto } from './dto/guild-sync.dto';

@ApiTags('Discord')
@Controller('discord')
@RequireApiKey()
export class DiscordController {
  constructor(private discord: DiscordService) {}

  @Post('guild-sync')
  @ApiOperation({
    summary: 'Sync guild membership',
    description: `**Called by:** Discord bot only.

Reconciles the \`profiles.in_guild\` flag against the current Discord guild roster. Users in the payload are flagged \`in_guild = true\`; previously-flagged users missing from the payload are reset to \`false\`.

**Triggers the mobile app's Join Server → Overview transition via realtime** — when \`in_guild\` flips to \`true\`, the onboarding screen subscribing to \`profiles\` receives the update and advances automatically.`,
  })
  syncGuild(@Body() body: GuildSyncDto) {
    return this.discord.syncGuildMembers(body.members);
  }
}
