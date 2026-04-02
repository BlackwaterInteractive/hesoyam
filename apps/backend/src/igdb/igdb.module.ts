import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IgdbService } from './igdb.service';
import { TwitchAuthService } from './twitch-auth.service';

@Module({
  imports: [HttpModule],
  providers: [IgdbService, TwitchAuthService],
  exports: [IgdbService, TwitchAuthService],
})
export class IgdbModule {}
