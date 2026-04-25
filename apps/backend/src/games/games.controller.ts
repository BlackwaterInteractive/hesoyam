import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireApiKey } from '../auth/decorators/api-key.decorator';
import { RequireJwt } from '../auth/decorators/jwt-auth.decorator';
import { GameResolverService } from './game-resolver.service';
import { IgdbService } from '../igdb/igdb.service';
import { ResolveGameDto } from './dto/resolve-game.dto';
import { SearchGamesDto } from './dto/search-games.dto';
import { ImportGameDto } from './dto/import-game.dto';
import { IgdbMetadataDto } from './dto/igdb-metadata.dto';

@ApiTags('Games')
@Controller('games')
export class GamesController {
  constructor(
    private gameResolver: GameResolverService,
    private igdb: IgdbService,
  ) {}

  @Post('resolve')
  @RequireApiKey()
  @ApiOperation({
    summary: 'Resolve a game name to a catalog row',
    description: `**Called by:** Discord bot only.

Maps a raw game name (as seen in Discord Rich Presence) to a canonical \`games\` row, creating one if the game is not yet in the RAID catalog.

**Resolution cascade:**
1. LRU cache by Discord \`applicationId\` (fastest, unambiguous).
2. LRU cache by normalized game name.
3. Exact DB match (case-insensitive).
4. Fuzzy DB match (pg_trgm similarity).
5. IGDB search + import into the catalog.
6. Minimal fallback row — creates a placeholder so the session can still start even if IGDB is down.

**Returns:** the resolved \`games\` row (\`id\`, \`name\`, \`slug\`, \`cover_url\`, \`igdb_id\`).`,
  })
  resolve(@Body() dto: ResolveGameDto) {
    return this.gameResolver.resolve(dto.gameName, dto.applicationId);
  }

  @Get('search')
  @RequireJwt()
  @ApiOperation({
    summary: 'Search IGDB for games',
    description: `**Called by:** mobile app, web dashboard (user-facing typeahead).

Proxies the IGDB \`/games\` search endpoint. Returns IGDB-shaped results: integer \`id\`, \`name\`, \`slug\`, \`cover.image_id\`, \`genres[].name\`, Unix \`first_release_date\`.

**Important:** results here are **not yet in the RAID catalog**. After the user picks one, call \`POST /games/import\` with the IGDB \`id\` to import it and get back a RAID UUID, then add to the user's library.`,
  })
  search(@Query() dto: SearchGamesDto) {
    return this.igdb.search(dto.query, dto.limit);
  }

  @Post('import')
  @RequireJwt()
  @ApiOperation({
    summary: 'Import a game from IGDB into the catalog',
    description: `**Called by:** mobile app, web dashboard.

Fetches full metadata from IGDB (cover, genres, developer, screenshots, ratings, platforms) and upserts into the \`games\` table with conflict resolution on \`igdb_id\`.

**Idempotent:** repeated imports of the same \`igdbId\` update the existing row's metadata and return the same RAID UUID — safe to call without checking membership first.

**Returns:** the imported \`games\` row (\`id\`, \`name\`, \`slug\`, \`cover_url\`, \`igdb_id\`).`,
  })
  importGame(@Body() dto: ImportGameDto) {
    return this.igdb.importById(dto.igdbId);
  }

  @Get('igdb/:id/metadata')
  @RequireJwt()
  @ApiOperation({
    summary: 'Fetch IGDB metadata without persisting',
    description: `**Called by:** admin app — Game Remap preview.

Returns full IGDB metadata for a given IGDB game id **without writing to the catalog**. Used by the admin "Remap Game" preview to compute the diff the operator will see before confirming.

Differs from \`POST /games/import\`, which upserts as a side effect. Do not use this endpoint for the resolver or library-add flows — they need the upsert behaviour.

**Returns:** \`IgdbMetadataDto\` (igdb_id, name, slug, cover_url, genres, developer, publisher, release_year, description, first_release_date, screenshots, artwork_url, rating, rating_count, platforms).`,
  })
  @ApiResponse({ status: 200, type: IgdbMetadataDto })
  getIgdbMetadata(@Param('id', ParseIntPipe) igdbId: number): Promise<IgdbMetadataDto> {
    return this.igdb.fetchGameData(igdbId);
  }
}
