import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CacheService } from '../core/cache/cache.service';
import { GamesService, ResolvedGame } from './games.service';
import { IgdbService } from '../igdb/igdb.service';

@Injectable()
export class GameResolverService {
  // In-flight deduplication: when many concurrent callers try to resolve the
  // same game before the cascade has populated cache, they all share one
  // Promise instead of fanning out to the DB / IGDB. Closes the "500 users
  // launch GTA VI at midnight" thundering-herd problem (#79).
  private readonly inFlightResolutions = new Map<
    string,
    Promise<ResolvedGame>
  >();

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

    // Sync-fast path: cache hits return before we hit any coalescing machinery.
    // Tier 0 / Tier 1 in the original cascade.
    const cacheHit = this.tryCacheHit(normalizedName, applicationId);
    if (cacheHit) {
      this.logger.debug(
        { gameName, hitBy: applicationId ? 'applicationId' : 'name' },
        'Game resolved from cache',
      );
      if (applicationId) await this.linkApplicationId(cacheHit, applicationId);
      return cacheHit;
    }

    // Coalesce the expensive path (DB + IGDB) by the most specific key
    // available. applicationId is unambiguous when present; otherwise we
    // coalesce by normalized name.
    const coalesceKey = applicationId
      ? `appid:${applicationId}`
      : `name:${normalizedName}`;

    const existing = this.inFlightResolutions.get(coalesceKey);
    if (existing) {
      this.logger.debug(
        { gameName, coalesceKey },
        'Resolve coalesced to in-flight request',
      );
      const resolved = await existing;
      // If the in-flight request started WITHOUT our applicationId, link
      // ours now that the canonical row is known.
      if (applicationId) await this.linkApplicationId(resolved, applicationId);
      return resolved;
    }

    const promise = this.resolveFromMiss(
      gameName,
      normalizedName,
      applicationId,
    ).finally(() => {
      this.inFlightResolutions.delete(coalesceKey);
    });

    this.inFlightResolutions.set(coalesceKey, promise);
    return promise;
  }

  /**
   * Cheap synchronous cache lookup. Returns a cached row if either the
   * applicationId-keyed or the normalized-name-keyed entry is present.
   */
  private tryCacheHit(
    normalizedName: string,
    applicationId?: string,
  ): ResolvedGame | undefined {
    if (applicationId) {
      const byAppId = this.cache.get<ResolvedGame>(
        'game-resolve',
        `appid:${applicationId}`,
      );
      if (byAppId) return byAppId;
    }
    return this.cache.get<ResolvedGame>('game-resolve', normalizedName);
  }

  /**
   * The original cascade minus the sync cache hits, which are already
   * handled by [tryCacheHit] before coalescing.
   *
   * Cascade order: applicationId DB → exact DB → fuzzy DB → IGDB → minimal.
   */
  private async resolveFromMiss(
    gameName: string,
    normalizedName: string,
    applicationId?: string,
  ): Promise<ResolvedGame> {
    // Tier 0 (DB half): try the applicationId fast path in the DB.
    if (applicationId) {
      const byAppId = await this.games.findByApplicationId(applicationId);
      if (byAppId) {
        this.logger.info(
          { gameName, applicationId, gameId: byAppId.id },
          'Game resolved via applicationId',
        );
        this.cache.set('game-resolve', `appid:${applicationId}`, byAppId);
        this.cache.set('game-resolve', normalizedName, byAppId);
        return byAppId;
      }
    }

    // Tier 2: Exact DB match (case-insensitive)
    const exact = await this.games.findExact(normalizedName);
    if (exact) {
      this.logger.debug(
        { gameName, gameId: exact.id },
        'Game resolved via exact DB match',
      );
      if (applicationId) await this.linkApplicationId(exact, applicationId);
      return this.cacheAndReturn(normalizedName, exact, applicationId);
    }

    // Tier 3: Fuzzy DB match (pg_trgm)
    const fuzzy = await this.games.findFuzzy(normalizedName);
    if (fuzzy) {
      this.logger.debug(
        { gameName, gameId: fuzzy.id },
        'Game resolved via fuzzy DB match',
      );
      if (applicationId) await this.linkApplicationId(fuzzy, applicationId);
      return this.cacheAndReturn(normalizedName, fuzzy, applicationId);
    }

    // Tier 4: IGDB search + import
    try {
      const igdbResult = await this.igdb.searchAndImport(gameName);
      if (igdbResult) {
        this.logger.info(
          { gameName, gameId: igdbResult.id },
          'Game resolved via IGDB',
        );
        if (applicationId) await this.linkApplicationId(igdbResult, applicationId);
        return this.cacheAndReturn(normalizedName, igdbResult, applicationId);
      }
    } catch (err) {
      this.logger.warn(
        { err, gameName },
        'IGDB search failed, falling back to minimal',
      );
    }

    // Tier 5: Minimal fallback
    const fallback = await this.games.createMinimal(gameName);
    this.logger.info(
      { gameName, gameId: fallback.id },
      'Game resolved via minimal fallback',
    );
    if (applicationId) await this.linkApplicationId(fallback, applicationId);
    return this.cacheAndReturn(normalizedName, fallback, applicationId);
  }

  /**
   * Save discord applicationId on the resolved game and cache under the appid key.
   */
  private async linkApplicationId(
    game: ResolvedGame,
    applicationId: string,
  ): Promise<void> {
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
