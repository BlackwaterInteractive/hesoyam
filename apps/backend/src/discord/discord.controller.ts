import { Body, Controller, Post } from '@nestjs/common';
import { RequireApiKey } from '../auth/decorators/api-key.decorator';
import { DiscordService } from './discord.service';

@Controller('discord')
@RequireApiKey()
export class DiscordController {
  constructor(private discord: DiscordService) {}

  @Post('guild-sync')
  syncGuild(@Body() body: { members: { discordId: string }[] }) {
    return this.discord.syncGuildMembers(body.members);
  }
}
