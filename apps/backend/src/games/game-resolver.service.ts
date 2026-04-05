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

    // 0. Discord applicationId fast path — unambiguous match
    if (applicationId) {
      const appIdKey = `appid:${applicationId}`;
      const cachedByAppId = this.cache.get<ResolvedGame>('game-resolve', appIdKey);
      if (cachedByAppId) {
        this.logger.debug({ gameName, applicationId }, 'Game resolved from cache (applicationId)');
        return cachedByAppId;
      }

      const byAppId = await this.games.findByApplicationId(applicationId);
      if (byAppId) {
        this.logger.info({ gameName, applicationId, gameId: byAppId.id }, 'Game resolved via applicationId');
        this.cache.set('game-resolve', appIdKey, byAppId);
        this.cache.set('game-resolve', normalizedName, byAppId);
        return byAppId;
      }
    }

    // 1. LRU cache check
    const cached = this.cache.get<ResolvedGame>('game-resolve', normalizedName);
    if (cached) {
      this.logger.debug({ gameName }, 'Game resolved from cache');
      if (applicationId) await this.linkApplicationId(cached, applicationId);
      return cached;
    }

    // 2. Exact DB match (case-insensitive)
    const exact = await this.games.findExact(normalizedName);
    if (exact) {
      this.logger.debug({ gameName, gameId: exact.id }, 'Game resolved via exact DB match');
      if (applicationId) await this.linkApplicationId(exact, applicationId);
      return this.cacheAndReturn(normalizedName, exact, applicationId);
    }

    // 3. Fuzzy DB match (pg_trgm)
    const fuzzy = await this.games.findFuzzy(normalizedName);
    if (fuzzy) {
      this.logger.debug({ gameName, gameId: fuzzy.id }, 'Game resolved via fuzzy DB match');
      if (applicationId) await this.linkApplicationId(fuzzy, applicationId);
      return this.cacheAndReturn(normalizedName, fuzzy, applicationId);
    }

    // 4. IGDB search + import
    try {
      const igdbResult = await this.igdb.searchAndImport(gameName);
      if (igdbResult) {
        this.logger.info({ gameName, gameId: igdbResult.id }, 'Game resolved via IGDB');
        if (applicationId) await this.linkApplicationId(igdbResult, applicationId);
        return this.cacheAndReturn(normalizedName, igdbResult, applicationId);
      }
    } catch (err) {
      this.logger.warn({ err, gameName }, 'IGDB search failed, falling back to minimal');
    }

    // 5. Minimal fallback
    const fallback = await this.games.createMinimal(gameName);
    this.logger.info({ gameName, gameId: fallback.id }, 'Game resolved via minimal fallback');
    if (applicationId) await this.linkApplicationId(fallback, applicationId);
    return this.cacheAndReturn(normalizedName, fallback, applicationId);
  }

  /**
   * Save discord applicationId on the resolved game and cache under the appid key.
   */
  private async linkApplicationId(game: ResolvedGame, applicationId: string): Promise<void> {
    if (game.id) {
      await this.games.setApplicationId(game.id, applicationId);
      this.cache.set('game-resolve', `appid:${applicationId}`, game);
    }
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
    applicationId?: string,
  ): ResolvedGame {
    this.cache.set('game-resolve', key, game);
    if (applicationId) {
      this.cache.set('game-resolve', `appid:${applicationId}`, game);
    }
    return game;
  }
}
