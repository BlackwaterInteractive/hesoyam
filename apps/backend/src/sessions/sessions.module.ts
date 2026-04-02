import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { GamesModule } from '../games/games.module';
import { PresenceModule } from '../presence/presence.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [GamesModule, PresenceModule, AuthModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
