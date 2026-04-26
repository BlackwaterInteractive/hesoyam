import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GameResolverService } from './game-resolver.service';
import { ReconciliationService } from './reconciliation.service';
import { IgdbModule } from '../igdb/igdb.module';
import { AuthModule } from '../auth/auth.module';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [IgdbModule, AuthModule, DiscordModule],
  controllers: [GamesController],
  providers: [GamesService, GameResolverService, ReconciliationService],
  exports: [GamesService, GameResolverService],
})
export class GamesModule {}
