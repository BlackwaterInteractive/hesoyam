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
    findExact: jest.Mock;
    findFuzzy: jest.Mock;
    createMinimal: jest.Mock;
    setApplicationId: jest.Mock;
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
      findExact: jest.fn(),
      findFuzzy: jest.fn(),
      createMinimal: jest.fn(),
      setApplicationId: jest.fn().mockResolvedValue(undefined),
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

  it('falls through to exact match when applicationId misses', async () => {
    const result = makeResolved();
    games.findByApplicationId.mockResolvedValueOnce(null);
    games.findExact.mockResolvedValueOnce(result);

    await service.resolve('RDR2', 'app-1');

    expect(games.findExact).toHaveBeenCalled();
    expect(games.findFuzzy).not.toHaveBeenCalled();
    expect(games.setApplicationId).toHaveBeenCalledWith(result.id, 'app-1');
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

  it('coalesced callers that provide an applicationId still get it linked afterward', async () => {
    const result = makeResolved({ id: 'canon' });
    games.findExact.mockImplementation(
      () => new Promise((r) => setTimeout(() => r(result), 30)),
    );

    // First caller has no applicationId; second caller has one.
    // They coalesce on `name:rdr2` — second caller must still have its
    // applicationId linked once the resolve settles.
    const [a, b] = await Promise.all([
      service.resolve('RDR2'),
      service.resolve('RDR2', 'late-app'),
    ]);

    expect(a).toEqual(result);
    expect(b).toEqual(result);
    expect(games.setApplicationId).toHaveBeenCalledWith('canon', 'late-app');
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

  it('Tier 0c skips Discord data for type=1 bots and falls through with the original presence string', async () => {
    const result = makeResolved();
    games.findByApplicationId.mockResolvedValueOnce(null);
    discordApp.fetchAppData.mockResolvedValueOnce(
      makeDiscordData({ name: 'carl-bot', type: 1, igdb_id: null }),
    );
    games.findExact.mockResolvedValueOnce(null);
    games.findFuzzy.mockResolvedValueOnce(null);
    igdb.searchAndImport.mockResolvedValueOnce(result);

    await service.resolve('Raw presence string', 'bot-app');

    // Bot data ignored: search runs against the original presence string,
    // and we do NOT persist Discord-side fields onto the row.
    expect(igdb.searchAndImport).toHaveBeenCalledWith('Raw presence string');
    expect(games.applyDiscordData).not.toHaveBeenCalled();
    // #114: at least the original presence string should land on discord_name.
    expect(games.setDiscordNameIfMissing).toHaveBeenCalled();
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
});
