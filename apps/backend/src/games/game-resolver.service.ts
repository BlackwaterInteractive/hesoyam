import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CacheService } from '../core/cache/cache.service';
import { GamesService, ResolvedGame } from './games.service';
import { IgdbService } from '../igdb/igdb.service';
import {
  DiscordAppData,
  DiscordAppService,
} from '../discord/discord-app.service';

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
    private discordApp: DiscordAppService,
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
      if (applicationId) await this.federateAndCache(cacheHit, applicationId);
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
      // If the in-flight request started WITHOUT our applicationId, federate
      // ours now that the canonical row is known.
      if (applicationId) await this.federateAndCache(resolved, applicationId);
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
   * Cascade order: applicationId DB → Discord lookup → exact DB → fuzzy DB
   * → IGDB → minimal.
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

    // Tier 0c: Ask Discord about the application id. Discord curates a
    // mapping from each app id to the game's IGDB id (third_party_skus
    // distributor=igdb), which lets us skip fuzzy IGDB name search entirely
    // when Discord knows the game. Eliminates #153-class mismatches for
    // any game Discord has cataloged.
    //
    // We do NOT filter by `type` here — Discord's type taxonomy (5 game,
    // null bot, etc) is brittle and only diagnostic. Federation handles
    // bot/launcher-style siblings via `linked_games` reverse lookup;
    // unmatched orphans are cleaned up by the admin Consolidate tool.
    let discordData: DiscordAppData | null = null;
    let searchName = gameName;
    let searchNormalizedName = normalizedName;
    if (applicationId) {
      discordData = await this.discordApp.fetchAppData(applicationId);

      if (discordData) {
        // Tier 0b: Reverse lookup via linked_games. Discord may report this
        // app id is linked to other already-known app ids (companion bots,
        // launchers, regional variants). If any sibling is already mapped
        // to an existing game, that's the canonical row — federate the new
        // id onto it instead of creating a duplicate. Makes ingestion order-
        // independent (concept: Commutative Ingestion).
        if (discordData.linked_app_ids.length > 0) {
          const reverseHits = await this.games.findByApplicationIds([
            applicationId,
            ...discordData.linked_app_ids,
          ]);
          if (reverseHits.length > 0) {
            const canonical = reverseHits[0].game;
            const distinctGameIds = new Set(
              reverseHits.map((h) => h.game.id),
            );
            if (distinctGameIds.size > 1) {
              this.logger.warn(
                {
                  gameName,
                  applicationId,
                  candidateGameIds: Array.from(distinctGameIds),
                  pickedGameId: canonical.id,
                },
                'Reverse lookup ambiguous — multiple existing games claim app ids in linked_games. Picked first; admin Consolidate can resolve.',
              );
            }
            await this.federateAndCache(canonical, applicationId, discordData);
            this.logger.info(
              {
                gameName,
                applicationId,
                gameId: canonical.id,
                matchedAppIds: reverseHits.map((h) => h.application_id),
              },
              'Game resolved via Discord linked_games reverse lookup',
            );
            return this.cacheAndReturn(
              normalizedName,
              canonical,
              applicationId,
            );
          }
        }

        if (discordData.igdb_id != null) {
          // Authoritative path: Discord told us the game's IGDB id directly.
          // Import by exact id — no name-based search, no chance of mismatch.
          try {
            const imported = await this.igdb.importById(discordData.igdb_id);
            if (imported) {
              await this.games.applyDiscordData(imported.id, discordData);
              await this.federateAndCache(imported, applicationId, discordData);
              this.logger.info(
                {
                  gameName,
                  applicationId,
                  gameId: imported.id,
                  igdbId: discordData.igdb_id,
                  discordName: discordData.name,
                },
                'Game resolved via Discord → IGDB id (authoritative)',
              );
              return this.cacheAndReturn(
                normalizedName,
                imported,
                applicationId,
              );
            }
          } catch (err) {
            // IGDB import failure here is unusual but not fatal — fall
            // through with Discord's name overriding the presence string,
            // so the rest of the cascade has a better query.
            this.logger.warn(
              { err, gameName, applicationId, igdbId: discordData.igdb_id },
              'Discord-mapped IGDB import failed — falling through with Discord name',
            );
          }
        }

        // No IGDB SKU (or import failed) but we still have Discord's
        // canonical name. Use it for the downstream DB / IGDB-search tiers
        // — it's more reliable than the raw presence string.
        if (discordData.name) {
          searchName = discordData.name;
          searchNormalizedName = this.normalize(discordData.name);
        }
      }
    }

    // Tier 2: Exact DB match (case-insensitive)
    const exact = await this.games.findExact(searchNormalizedName);
    if (exact) {
      this.logger.debug(
        { gameName, gameId: exact.id },
        'Game resolved via exact DB match',
      );
      if (applicationId) {
        await this.federateAndCache(exact, applicationId, discordData);
      }
      await this.persistDiscordOrPresence(exact.id, discordData, gameName);
      return this.cacheAndReturn(normalizedName, exact, applicationId);
    }

    // Tier 3: Fuzzy DB match (pg_trgm)
    const fuzzy = await this.games.findFuzzy(searchNormalizedName);
    if (fuzzy) {
      this.logger.debug(
        { gameName, gameId: fuzzy.id },
        'Game resolved via fuzzy DB match',
      );
      if (applicationId) {
        await this.federateAndCache(fuzzy, applicationId, discordData);
      }
      await this.persistDiscordOrPresence(fuzzy.id, discordData, gameName);
      return this.cacheAndReturn(normalizedName, fuzzy, applicationId);
    }

    // Tier 4: IGDB search + import
    try {
      const igdbResult = await this.igdb.searchAndImport(searchName);
      if (igdbResult) {
        this.logger.info(
          { gameName, gameId: igdbResult.id },
          'Game resolved via IGDB',
        );
        if (applicationId) {
          await this.federateAndCache(igdbResult, applicationId, discordData);
        }
        await this.persistDiscordOrPresence(igdbResult.id, discordData, gameName);
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
    if (applicationId) {
      await this.federateAndCache(fallback, applicationId, discordData);
    }
    await this.persistDiscordOrPresence(fallback.id, discordData, gameName);
    return this.cacheAndReturn(normalizedName, fallback, applicationId);
  }

  /**
   * Clear the entire resolver cache after an admin Consolidate action.
   *
   * Why nuke the whole bucket instead of deleting only the moved app ids:
   * the cache holds two key shapes per resolution — `appid:X` AND a
   * normalized-name key (`name:<normalized>`). After consolidate, BOTH
   * shapes might point at the now-deleted orphan game id (e.g. the
   * orphan's name "Delta Force Game" got cached as `name:delta force game
   * → orphan_id` during a presence event before consolidate). Deleting
   * only the `appid:` keys leaves the name-keyed entry behind and the
   * resolver still hands out the deleted id on the next name-only lookup.
   *
   * The bucket is bounded (`max: 2000`) and repopulates on demand via
   * the existing in-flight coalescing — no thundering-herd risk. The
   * cost is a brief miss-spike on next resolves, invisible at our scale.
   *
   * `applicationIds` is taken for audit logging only; the entire bucket
   * is cleared regardless of which ids prompted the invalidation. Issue
   * #194 PR 2.
   */
  invalidateApplicationIds(applicationIds: string[]): number {
    this.cache.clear('game-resolve');
    this.logger.info(
      { applicationIds, count: applicationIds.length },
      'Resolver cache cleared after admin Consolidate',
    );
    return applicationIds.length;
  }

  /**
   * Persist Discord-side metadata onto the resolved row. Prefers full RPC
   * data when available; otherwise falls back to capturing the original
   * presence string as `discord_name` so admins can see "Discord said X →
   * matched to Y" even when we never reached the RPC endpoint. Closes #114.
   */
  private async persistDiscordOrPresence(
    gameId: string,
    discordData: DiscordAppData | null,
    presenceName: string,
  ): Promise<void> {
    if (discordData) {
      await this.games.applyDiscordData(gameId, discordData);
    } else {
      await this.games.setDiscordNameIfMissing(gameId, presenceName);
    }
  }

  /**
   * Federate the resolved game's Discord application IDs into the junction
   * table (`game_discord_applications`) and pre-warm the resolver cache for
   * each. `discordData` is optional — supplied on post-RPC paths so that
   * RPC's `linked_games` siblings (launcher, regional variants) get mapped
   * to the same canonical row before they're ever seen as a presence event.
   * Pre-RPC paths (cache hit, coalesced waiter) only have `applicationId`
   * and link just the primary.
   *
   * Race-safety: `linkDiscordApplications` writes via `ON CONFLICT
   * (application_id) DO NOTHING`, so concurrent writers can't produce
   * duplicate junction rows. If two callers race to claim the same id for
   * different games, the loser silently no-ops; the next forward lookup
   * via cache or DB returns the winner's canonical row.
   */
  private async federateAndCache(
    game: ResolvedGame,
    applicationId: string,
    discordData?: DiscordAppData | null,
  ): Promise<void> {
    if (!game.id) return;
    const linkedAppIds = discordData?.linked_app_ids ?? [];
    await this.games.linkDiscordApplications(
      game.id,
      applicationId,
      linkedAppIds,
    );
    // Pre-warm the resolver cache for every id we just federated. Subsequent
    // presence events for any of these ids resolve in microseconds without
    // touching DB or RPC.
    this.cache.set('game-resolve', `appid:${applicationId}`, game);
    for (const appId of linkedAppIds) {
      this.cache.set('game-resolve', `appid:${appId}`, game);
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
