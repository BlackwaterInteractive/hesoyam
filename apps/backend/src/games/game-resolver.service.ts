import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CacheService } from '../core/cache/cache.service';
import { GamesService, ResolvedGame } from './games.service';
import { IgdbService } from '../igdb/igdb.service';

@Injectable()
export class GameResolverService {
  constructor(
    private games: GamesService,
    private igdb: IgdbService,
    private cache: CacheService,
    @InjectPinoLogger(GameResolverService.name) private logger: PinoLogger,
  ) {}

  async resolve(
    gameName: string,
    applicationId?: string,
  ): Promise<ResolvedGame> {
    const normalizedName = this.normalize(gameName);

    // 1. LRU cache check
    const cached = this.cache.get<ResolvedGame>('game-resolve', normalizedName);
    if (cached) {
      this.logger.debug({ gameName }, 'Game resolved from cache');
      return cached;
    }

    // 2. Exact DB match (case-insensitive)
    const exact = await this.games.findExact(normalizedName);
    if (exact) {
      this.logger.debug({ gameName, gameId: exact.id }, 'Game resolved via exact DB match');
      return this.cacheAndReturn(normalizedName, exact);
    }

    // 3. Fuzzy DB match (pg_trgm)
    const fuzzy = await this.games.findFuzzy(normalizedName);
    if (fuzzy) {
      this.logger.debug({ gameName, gameId: fuzzy.id }, 'Game resolved via fuzzy DB match');
      return this.cacheAndReturn(normalizedName, fuzzy);
    }

    // 4. IGDB search + import
    try {
      const igdbResult = await this.igdb.searchAndImport(gameName);
      if (igdbResult) {
        this.logger.info({ gameName, gameId: igdbResult.id }, 'Game resolved via IGDB');
        return this.cacheAndReturn(normalizedName, igdbResult);
      }
    } catch (err) {
      this.logger.warn({ err, gameName }, 'IGDB search failed, falling back to minimal');
    }

    // 5. Minimal fallback
    const fallback = await this.games.createMinimal(gameName);
    this.logger.info({ gameName, gameId: fallback.id }, 'Game resolved via minimal fallback');
    return this.cacheAndReturn(normalizedName, fallback);
  }

  private normalize(name: string): string {
    return name
      .toLowerCase()
      .replace(/[™®©]/g, '')
      .trim();
  }

  private cacheAndReturn(
    key: string,
    game: ResolvedGame,
  ): ResolvedGame {
    this.cache.set('game-resolve', key, game);
    return game;
  }
}
