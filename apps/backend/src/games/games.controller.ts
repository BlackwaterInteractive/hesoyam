import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RequireApiKey } from '../auth/decorators/api-key.decorator';
import { RequireJwt } from '../auth/decorators/jwt-auth.decorator';
import { GameResolverService } from './game-resolver.service';
import { IgdbService } from '../igdb/igdb.service';
import { ResolveGameDto } from './dto/resolve-game.dto';
import { SearchGamesDto } from './dto/search-games.dto';
import { ImportGameDto } from './dto/import-game.dto';

@Controller('games')
export class GamesController {
  constructor(
    private gameResolver: GameResolverService,
    private igdb: IgdbService,
  ) {}

  @Post('resolve')
  @RequireApiKey()
  resolve(@Body() dto: ResolveGameDto) {
    return this.gameResolver.resolve(dto.gameName, dto.applicationId);
  }

  @Get('search')
  @RequireJwt()
  search(@Query() dto: SearchGamesDto) {
    return this.igdb.search(dto.query, dto.limit);
  }

  @Post('import')
  @RequireJwt()
  importGame(@Body() dto: ImportGameDto) {
    return this.igdb.importById(dto.igdbId);
  }
}
