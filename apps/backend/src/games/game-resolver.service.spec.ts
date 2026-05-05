import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getLoggerToken } from 'nestjs-pino';
import { CacheService } from '../core/cache/cache.service';
import { GameResolverService } from './game-resolver.service';
import { GamesService, ResolvedGame } from './games.service';
import { IgdbService } from '../igdb/igdb.service';
import {
  DiscordAppData,
  DiscordAppService,
} from '../discord/discord-app.service';

/**
 * Covers the cascade + in-flight deduplication added for #79.
 *
 * Uses the real CacheService (same choice as igdb.service.spec.ts) because
 * the point is to test integration against actual cache semantics, not a
 * mock of them.
 */
describe('GameResolverService', () => {
  let service: GameResolverService;
  let games: {
    findByApplicationId: jest.Mock;
    findByApplicationIds: jest.Mock;
    findExact: jest.Mock;
    findFuzzy: jest.Mock;
    createMinimal: jest.Mock;
    linkDiscordApplications: jest.Mock;
    applyDiscordData: jest.Mock;
    setDiscordNameIfMissing: jest.Mock;
  };
  let igdb: { searchAndImport: jest.Mock; importById: jest.Mock };
  let discordApp: { fetchAppData: jest.Mock };

  const noopLogger = () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  });

  const makeResolved = (overrides: Partial<ResolvedGame> = {}): ResolvedGame => ({
    id: overrides.id ?? 'canonical-uuid',
    name: overrides.name ?? 'Red Dead Redemption 2',
    slug: overrides.slug ?? 'red-dead-redemption-2',
    cover_url: overrides.cover_url ?? null,
    igdb_id: overrides.igdb_id ?? 25076,
  });

  beforeEach(async () => {
    games = {
      findByApplicationId: jest.fn(),
      // Default: reverse-lookup misses unless a test sets it. Keeps Tier 0c
      // tests that don't use linked_games unaffected.
      findByApplicationIds: jest.fn().mockResolvedValue([]),
      findExact: jest.fn(),
      findFuzzy: jest.fn(),
      createMinimal: jest.fn(),
      linkDiscordApplications: jest.fn().mockResolvedValue(undefined),
      applyDiscordData: jest.fn().mockResolvedValue(undefined),
      setDiscordNameIfMissing: jest.fn().mockResolvedValue(undefined),
    };
    igdb = {
      searchAndImport: jest.fn(),
      importById: jest.fn(),
    };
    // Default Discord lookup: returns null (no data) so the cascade behaves
    // like the pre-#160 baseline. Per-test overrides exercise Tier 0c.
    discordApp = {
      fetchAppData: jest.fn().mockResolvedValue(null),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        GameResolverService,
        CacheService,
        { provide: GamesService, useValue: games },
        { provide: IgdbService, useValue: igdb },
        { provide: DiscordAppService, useValue: discordApp },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => 'fake',
            get: <T>(_k: string, d: T): T => d,
          },
        },
        {
          provide: getLoggerToken(GameResolverService.name),
          useValue: noopLogger(),
        },
        { provide: getLoggerToken(CacheService.name), useValue: noopLogger() },
      ],
    }).compile();

    await moduleRef.init(); // triggers CacheService.onModuleInit
    service = moduleRef.get(GameResolverService);
  });

  // Helper for building Discord lookup return values in Tier 0c tests.
  const makeDiscordData = (
    overrides: Partial<DiscordAppData> = {},
  ): DiscordAppData => ({
    id: overrides.id ?? 'discord-app-id',
    name: overrides.name ?? 'Red Dead Redemption 2',
    description: overrides.description ?? null,
    type: overrides.type ?? 5,
    icon: overrides.icon ?? null,
    cover_image: overrides.cover_image ?? null,
    aliases: overrides.aliases ?? [],
    linked_app_ids: overrides.linked_app_ids ?? [],
    igdb_id: overrides.igdb_id ?? null,
    steam_app_id: overrides.steam_app_id ?? null,
    gog_id: overrides.gog_id ?? null,
    epic_id: overrides.epic_id ?? null,
    xbox_app_id: overrides.xbox_app_id ?? null,
    opencritic_id: overrides.opencritic_id ?? null,
  });

  // ── Cascade ─────────────────────────────────────────────────────────────

  it('returns applicationId DB match before touching name tiers', async () => {
    const result = makeResolved();
    games.findByApplicationId.mockResolvedValueOnce(result);

    const out = await service.resolve('RDR2', 'app-1');

    expect(out).toEqual(result);
    expect(games.findByApplicationId).toHaveBeenCalledWith('app-1');
    expect(games.findExact).not.toHaveBeenCalled();
    expect(games.findFuzzy).not.toHaveBeenCalled();
  });

  it('falls through to exact match when applicationId misses, federates the app id onto the row', async () => {
    const result = makeResolved();
    games.findByApplicationId.mockResolvedValueOnce(null);
    games.findExact.mockResolvedValueOnce(result);

    await service.resolve('RDR2', 'app-1');

    expect(games.findExact).toHaveBeenCalled();
    expect(games.findFuzzy).not.toHaveBeenCalled();
    // No Discord RPC data here (mock returns null by default), so just the
    // primary application id gets seeded; no linked siblings.
    expect(games.linkDiscordApplications).toHaveBeenCalledWith(
      result.id,
      'app-1',
      [],
    );
  });

  it('falls through to fuzzy match when exact misses', async () => {
    const result = makeResolved();
    games.findExact.mockResolvedValueOnce(null);
    games.findFuzzy.mockResolvedValueOnce(result);

    await service.resolve('RDR2');

    expect(games.findFuzzy).toHaveBeenCalled();
    expect(igdb.searchAndImport).not.toHaveBeenCalled();
  });

  it('falls through to IGDB import when fuzzy misses', async () => {
    const result = makeResolved();
    games.findExact.mockResolvedValueOnce(null);
    games.findFuzzy.mockResolvedValueOnce(null);
    igdb.searchAndImport.mockResolvedValueOnce(result);

    await service.resolve('RDR2');

    expect(igdb.searchAndImport).toHaveBeenCalledWith('RDR2');
    expect(games.createMinimal).not.toHaveBeenCalled();
  });

  it('falls through to minimal when IGDB returns null', async () => {
    const minimal = makeResolved({ id: 'minimal-uuid', igdb_id: null });
    games.findExact.mockResolvedValueOnce(null);
    games.findFuzzy.mockResolvedValueOnce(null);
    igdb.searchAndImport.mockResolvedValueOnce(null);
    games.createMinimal.mockResolvedValueOnce(minimal);

    const out = await service.resolve('RDR2');

    expect(out.id).toBe('minimal-uuid');
    expect(games.createMinimal).toHaveBeenCalledWith('RDR2');
  });

  it('falls through to minimal when IGDB throws', async () => {
    const minimal = makeResolved({ id: 'minimal-uuid', igdb_id: null });
    games.findExact.mockResolvedValueOnce(null);
    games.findFuzzy.mockResolvedValueOnce(null);
    igdb.searchAndImport.mockRejectedValueOnce(new Error('IGDB down'));
    games.createMinimal.mockResolvedValueOnce(minimal);

    const out = await service.resolve('RDR2');

    expect(out.id).toBe('minimal-uuid');
  });

  // ── Caching ─────────────────────────────────────────────────────────────

  it('caches the result and serves subsequent calls from cache', async () => {
    const result = makeResolved();
    games.findExact.mockResolvedValueOnce(result);

    await service.resolve('RDR2');
    await service.resolve('RDR2');
    await service.resolve('RDR2');

    expect(games.findExact).toHaveBeenCalledTimes(1);
  });

  it('normalises query — casing, whitespace, and trademark symbols share a cache key', async () => {
    const result = makeResolved();
    games.findExact.mockResolvedValueOnce(result);

    await service.resolve('RDR2');
    await service.resolve('  rdr2  ');
    await service.resolve('RDR2™');

    expect(games.findExact).toHaveBeenCalledTimes(1);
  });

  it('applicationId cache hit skips the DB entirely on subsequent calls', async () => {
    const result = makeResolved();
    games.findByApplicationId.mockResolvedValueOnce(result);

    await service.resolve('RDR2', 'app-1');
    await service.resolve('RDR2', 'app-1');

    expect(games.findByApplicationId).toHaveBeenCalledTimes(1);
  });

  // ── Promise coalescing (the #79 fix) ────────────────────────────────────

  it('coalesces 10 concurrent cold-cache resolves by name into 1 cascade', async () => {
    const result = makeResolved();
    // Simulate a slow cascade: fuzzy miss, then IGDB import takes 50ms.
    games.findExact.mockResolvedValue(null);
    games.findFuzzy.mockResolvedValue(null);
    igdb.searchAndImport.mockImplementation(
      () => new Promise((r) => setTimeout(() => r(result), 50)),
    );

    const calls = await Promise.all(
      Array.from({ length: 10 }, () => service.resolve('Elden Ring')),
    );

    expect(calls).toHaveLength(10);
    calls.forEach((r) => expect(r).toEqual(result));
    // The whole cascade (exact, fuzzy, IGDB) runs exactly once for 10 callers.
    expect(games.findExact).toHaveBeenCalledTimes(1);
    expect(games.findFuzzy).toHaveBeenCalledTimes(1);
    expect(igdb.searchAndImport).toHaveBeenCalledTimes(1);
  });

  it('coalesces by applicationId when it is provided', async () => {
    const result = makeResolved();
    games.findByApplicationId.mockImplementation(
      () => new Promise((r) => setTimeout(() => r(result), 30)),
    );

    const calls = await Promise.all(
      Array.from({ length: 5 }, () => service.resolve('RDR2', 'app-1')),
    );

    expect(calls).toHaveLength(5);
    expect(games.findByApplicationId).toHaveBeenCalledTimes(1);
  });

  it('coalesced callers that provide an applicationId still get it federated afterward', async () => {
    const result = makeResolved({ id: 'canon' });
    games.findExact.mockImplementation(
      () => new Promise((r) => setTimeout(() => r(result), 30)),
    );

    // First caller has no applicationId; second caller has one.
    // They coalesce on `name:rdr2` — second caller must still have its
    // applicationId federated onto the canonical row once the resolve settles.
    const [a, b] = await Promise.all([
      service.resolve('RDR2'),
      service.resolve('RDR2', 'late-app'),
    ]);

    expect(a).toEqual(result);
    expect(b).toEqual(result);
    expect(games.linkDiscordApplications).toHaveBeenCalledWith(
      'canon',
      'late-app',
      [],
    );
  });

  it('clears the in-flight entry after resolution, allowing a later fresh cascade', async () => {
    // First call fails — propagates, inflight must be cleared.
    games.findExact.mockRejectedValueOnce(new Error('DB down'));
    await expect(service.resolve('RDR2')).rejects.toThrow('DB down');

    // Second call should re-enter the cascade (not share the failed promise).
    const result = makeResolved();
    games.findExact.mockResolvedValueOnce(result);
    const out = await service.resolve('RDR2');
    expect(out).toEqual(result);
  });

  it('non-IGDB errors still propagate to coalesced callers', async () => {
    games.findExact.mockImplementation(
      () =>
        new Promise((_r, reject) =>
          setTimeout(() => reject(new Error('DB down')), 20),
        ),
    );

    const promises = Array.from({ length: 3 }, () => service.resolve('RDR2'));
    await Promise.allSettled(promises);

    // All three should reject with the same error from the single cascade.
    for (const p of promises) {
      await expect(p).rejects.toThrow('DB down');
    }
    expect(games.findExact).toHaveBeenCalledTimes(1);
  });

  // ── Tier 0c: Discord application lookup (#160) ───────────────────────────

  it('Tier 0c authoritative path: Discord has igdb sku → import by exact igdb_id, skip name-based tiers', async () => {
    const result = makeResolved({ id: 'discord-resolved', igdb_id: 1970 });
    games.findByApplicationId.mockResolvedValueOnce(null);
    discordApp.fetchAppData.mockResolvedValueOnce(
      makeDiscordData({ name: "Assassin's Creed IV", igdb_id: 1970 }),
    );
    igdb.importById.mockResolvedValueOnce(result);

    const out = await service.resolve('Black Flag', 'app-1');

    expect(out).toEqual(result);
    expect(igdb.importById).toHaveBeenCalledWith(1970);
    // Name-based tiers must not run when Discord gives us the id directly.
    expect(games.findExact).not.toHaveBeenCalled();
    expect(games.findFuzzy).not.toHaveBeenCalled();
    expect(igdb.searchAndImport).not.toHaveBeenCalled();
    // Discord-side fields persisted onto the resolved row.
    expect(games.applyDiscordData).toHaveBeenCalledWith(
      'discord-resolved',
      expect.objectContaining({ igdb_id: 1970 }),
    );
  });

  it('Tier 0c falls through with Discord canonical name when no igdb sku', async () => {
    const result = makeResolved();
    games.findByApplicationId.mockResolvedValueOnce(null);
    discordApp.fetchAppData.mockResolvedValueOnce(
      makeDiscordData({ name: 'Canonical Discord Name', igdb_id: null }),
    );
    games.findExact.mockResolvedValueOnce(null);
    games.findFuzzy.mockResolvedValueOnce(null);
    igdb.searchAndImport.mockResolvedValueOnce(result);

    await service.resolve('Raw presence string', 'app-2');

    // Existing tiers run, but with Discord's name as the search query.
    expect(igdb.searchAndImport).toHaveBeenCalledWith('Canonical Discord Name');
    expect(igdb.importById).not.toHaveBeenCalled();
    expect(games.applyDiscordData).toHaveBeenCalled();
  });

  it('Tier 0c does NOT filter by Discord application type — applications with no IGDB sku just fall through normally and persist whatever Discord metadata is available', async () => {
    // Pre-#194 the resolver had a hardcoded `type === 1` "bot filter" that
    // skipped applyDiscordData. The constant was wrong (Discord type 1 is
    // legacy Game, not bot — bots are type=null), and the filter caused
    // legitimate game RPC data to be discarded for any application that
    // happened to come back as type 1. Federation handles bot/launcher
    // siblings via linked_games + admin Consolidate; no type filter needed.
    const result = makeResolved();
    games.findByApplicationId.mockResolvedValueOnce(null);
    discordApp.fetchAppData.mockResolvedValueOnce(
      makeDiscordData({
        name: 'Discord Canonical Name',
        type: 1,
        igdb_id: null,
      }),
    );
    games.findExact.mockResolvedValueOnce(null);
    games.findFuzzy.mockResolvedValueOnce(null);
    igdb.searchAndImport.mockResolvedValueOnce(result);

    await service.resolve('Raw presence string', 'app-typeone');

    // No type filter — Discord's name overrides the presence string for
    // downstream search, and Discord metadata gets persisted onto the row.
    expect(igdb.searchAndImport).toHaveBeenCalledWith('Discord Canonical Name');
    expect(games.applyDiscordData).toHaveBeenCalled();
  });

  // ── Tier 0b: linked_games reverse lookup (#194) ─────────────────────────

  it('reverse lookup: when RPC linked_games match an existing canonical row, federates the new app id onto it instead of creating a new game', async () => {
    // Order B from issue #194: launcher arrived first and created a game.
    // Now the main app arrives, RPC reports linked_games = [launcher]. The
    // resolver must merge into the existing row, not create a new one.
    const canonical = makeResolved({ id: 'canonical-game' });
    games.findByApplicationId.mockResolvedValueOnce(null); // forward miss
    discordApp.fetchAppData.mockResolvedValueOnce(
      makeDiscordData({
        name: 'Delta Force',
        igdb_id: 262186,
        linked_app_ids: ['launcher-app-id'],
      }),
    );
    games.findByApplicationIds.mockResolvedValueOnce([
      { application_id: 'launcher-app-id', game: canonical },
    ]);

    const out = await service.resolve('Delta Force', 'main-app-id');

    expect(out).toEqual(canonical);
    // No name-based tiers, no IGDB import — the existing row wins.
    expect(games.findExact).not.toHaveBeenCalled();
    expect(games.findFuzzy).not.toHaveBeenCalled();
    expect(igdb.importById).not.toHaveBeenCalled();
    expect(igdb.searchAndImport).not.toHaveBeenCalled();
    // The new app id gets federated onto the canonical row, alongside its
    // RPC-reported linked siblings (idempotent on conflict).
    expect(games.linkDiscordApplications).toHaveBeenCalledWith(
      'canonical-game',
      'main-app-id',
      ['launcher-app-id'],
    );
  });

  it('reverse lookup miss does not affect the rest of the cascade', async () => {
    const result = makeResolved({ id: 'imported', igdb_id: 1970 });
    games.findByApplicationId.mockResolvedValueOnce(null);
    discordApp.fetchAppData.mockResolvedValueOnce(
      makeDiscordData({
        name: 'Some Game',
        igdb_id: 1970,
        linked_app_ids: ['unknown-sibling'],
      }),
    );
    games.findByApplicationIds.mockResolvedValueOnce([]); // siblings unknown
    igdb.importById.mockResolvedValueOnce(result);

    const out = await service.resolve('Some Game', 'app-x');

    expect(out).toEqual(result);
    // IGDB authoritative path takes over (igdb_id present), still seeds
    // both primary AND linked sibling onto the new row for future events.
    expect(games.linkDiscordApplications).toHaveBeenCalledWith(
      'imported',
      'app-x',
      ['unknown-sibling'],
    );
  });

  // Commutative ingestion: regardless of which app id Discord broadcasts
  // first, both end up federated onto the same canonical row. Split into
  // two it-blocks so each gets a clean service via beforeEach (otherwise
  // the resolver's LRU cache would carry the first call's result through).

  it('commutative order A: main app arrives first → IGDB import + linked_games seeded', async () => {
    const canonical = makeResolved({ id: 'canon-from-main', igdb_id: 262186 });
    games.findByApplicationId.mockResolvedValueOnce(null);
    discordApp.fetchAppData.mockResolvedValueOnce(
      makeDiscordData({
        name: 'Delta Force',
        igdb_id: 262186,
        linked_app_ids: ['launcher'],
      }),
    );
    games.findByApplicationIds.mockResolvedValueOnce([]); // launcher unknown
    igdb.importById.mockResolvedValueOnce(canonical);

    const out = await service.resolve('Delta Force', 'main');

    expect(out).toEqual(canonical);
    expect(games.linkDiscordApplications).toHaveBeenCalledWith(
      'canon-from-main',
      'main',
      ['launcher'],
    );
  });

  it('commutative order B: launcher already federated → main app folds in via reverse lookup, no IGDB import', async () => {
    const canonical = makeResolved({
      id: 'canon-from-launcher',
      igdb_id: 262186,
    });
    games.findByApplicationId.mockResolvedValueOnce(null);
    discordApp.fetchAppData.mockResolvedValueOnce(
      makeDiscordData({
        name: 'Delta Force',
        igdb_id: 262186,
        linked_app_ids: ['launcher'],
      }),
    );
    // Reverse lookup hits — launcher already maps to a canonical row.
    games.findByApplicationIds.mockResolvedValueOnce([
      { application_id: 'launcher', game: canonical },
    ]);

    const out = await service.resolve('Delta Force', 'main');

    expect(out).toEqual(canonical);
    expect(igdb.importById).not.toHaveBeenCalled();
    expect(games.linkDiscordApplications).toHaveBeenCalledWith(
      'canon-from-launcher',
      'main',
      ['launcher'],
    );
  });

  it('Tier 0c is bypassed entirely when no applicationId is provided', async () => {
    const result = makeResolved();
    games.findExact.mockResolvedValueOnce(result);

    await service.resolve('RDR2');

    expect(discordApp.fetchAppData).not.toHaveBeenCalled();
    // No discord data → presence string captured for #114.
    expect(games.setDiscordNameIfMissing).toHaveBeenCalledWith(
      result.id,
      'RDR2',
    );
  });

  it('Tier 0c falls through gracefully when Discord returns null (404 or transient error)', async () => {
    const result = makeResolved();
    games.findByApplicationId.mockResolvedValueOnce(null);
    discordApp.fetchAppData.mockResolvedValueOnce(null); // 404 or error
    games.findExact.mockResolvedValueOnce(result);

    const out = await service.resolve('RDR2', 'unknown-app');

    expect(out).toEqual(result);
    // Original presence string used for the search.
    expect(games.findExact).toHaveBeenCalled();
    // No Discord data → presence string captured for #114.
    expect(games.setDiscordNameIfMissing).toHaveBeenCalled();
  });

  it('Tier 0c importById failure falls through with Discord name as the search', async () => {
    const result = makeResolved();
    games.findByApplicationId.mockResolvedValueOnce(null);
    discordApp.fetchAppData.mockResolvedValueOnce(
      makeDiscordData({ name: 'Discord Name', igdb_id: 99999 }),
    );
    igdb.importById.mockRejectedValueOnce(new Error('IGDB hiccup'));
    games.findExact.mockResolvedValueOnce(null);
    games.findFuzzy.mockResolvedValueOnce(null);
    igdb.searchAndImport.mockResolvedValueOnce(result);

    await service.resolve('Raw presence', 'app-z');

    // Falls through using Discord's name (better than presence string).
    expect(igdb.searchAndImport).toHaveBeenCalledWith('Discord Name');
    // Discord-side fields still applied to the eventually-resolved row.
    expect(games.applyDiscordData).toHaveBeenCalled();
  });

  // ── Cache invalidation (admin Consolidate hook, #194 PR 2) ──────────────

  it('invalidateApplicationIds drops cached entries so subsequent resolves re-hit DB', async () => {
    const orphanGame = makeResolved({ id: 'orphan-game' });
    const canonicalGame = makeResolved({ id: 'canonical-game' });

    // Warm the cache via a normal resolve: applicationId fast path returns
    // the orphan (simulating the pre-consolidate state).
    games.findByApplicationId.mockResolvedValueOnce(orphanGame);
    const first = await service.resolve('Delta Force Game', 'orphan-app');
    expect(first.id).toBe('orphan-game');
    expect(games.findByApplicationId).toHaveBeenCalledTimes(1);

    // Same call hits the cache — no new DB lookup.
    await service.resolve('Delta Force Game', 'orphan-app');
    expect(games.findByApplicationId).toHaveBeenCalledTimes(1);

    // Admin consolidates: invalidate the cache for the moved app id.
    const count = service.invalidateApplicationIds(['orphan-app']);
    expect(count).toBe(1);

    // Next resolve must touch DB again. Now the junction returns canonical.
    games.findByApplicationId.mockResolvedValueOnce(canonicalGame);
    const second = await service.resolve('Delta Force Game', 'orphan-app');
    expect(second.id).toBe('canonical-game');
    expect(games.findByApplicationId).toHaveBeenCalledTimes(2);
  });

  it('invalidateApplicationIds is a no-op for ids that were never cached', async () => {
    const count = service.invalidateApplicationIds(['never-cached-1', 'never-cached-2']);
    // Returns the number of delete calls made, not the number of entries actually present.
    expect(count).toBe(2);
    // No DB calls.
    expect(games.findByApplicationId).not.toHaveBeenCalled();
  });
});
