import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DiscordController } from './discord.controller';
import { DiscordService } from './discord.service';
import { DiscordAppService } from './discord-app.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, HttpModule],
  controllers: [DiscordController],
  providers: [DiscordService, DiscordAppService],
  exports: [DiscordAppService],
})
export class DiscordModule {}
