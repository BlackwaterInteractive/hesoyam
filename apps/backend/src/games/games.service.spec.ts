import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { GamesService } from './games.service';
import { SupabaseService } from '../core/supabase/supabase.service';
import { DiscordAppData } from '../discord/discord-app.service';

/**
 * Covers the non-trivial GamesService methods: dynamic update construction
 * (applyDiscordData, the "never clobber curated values" invariant), the
 * slug regex pipeline + timestamp suffix in createMinimal, and the
 * conditional updates with .is(...null) filters used by setApplicationId
 * and setDiscordNameIfMissing. Pure pass-through queries (findExact,
 * findFuzzy, findByApplicationId) are intentionally not covered — they
 * test the Supabase SDK, not us.
 */
describe('GamesService', () => {
  let service: GamesService;
  let from: jest.Mock;

  const noopLogger = () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  });

  type ChainResult = { data: unknown; error: unknown };
  const chain = (result: ChainResult) => {
    const c: Record<string, jest.Mock | unknown> = {};
    [
      'select',
      'eq',
      'is',
      'not',
      'order',
      'limit',
      'in',
      'update',
      'insert',
      'ilike',
      'rpc',
    ].forEach((m) => {
      c[m] = jest.fn(() => c);
    });
    c.single = jest.fn().mockResolvedValue(result);
    c.then = (resolve: (v: ChainResult) => unknown) =>
      Promise.resolve(result).then(resolve);
    return c as Record<string, jest.Mock> & PromiseLike<ChainResult>;
  };

  const buildService = async (): Promise<GamesService> => {
    from = jest.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ from }) },
        },
        { provide: getLoggerToken(GamesService.name), useValue: noopLogger() },
      ],
    }).compile();
    return moduleRef.get(GamesService);
  };

  beforeEach(async () => {
    service = await buildService();
  });

  describe('applyDiscordData — never clobbers curated values with nulls', () => {
    const fullData: DiscordAppData = {
      id: '12345',
      name: 'Hades',
      description: null,
      type: 0,
      icon: null,
      cover_image: null,
      aliases: ['Hades I', 'SuperGiant Hades'],
      igdb_id: 113112,
      steam_app_id: '1145360',
      gog_id: '1207659145',
      epic_id: 'hades-epic',
      xbox_app_id: 'BCRGV4FCDFL5',
      opencritic_id: '8483',
    };

    it('writes every populated field when all are present', async () => {
      const c = chain({ data: null, error: null });
      from.mockReturnValue(c);

      await service.applyDiscordData('game-1', fullData);

      expect(from).toHaveBeenCalledWith('games');
      expect(c.update).toHaveBeenCalledWith({
        discord_name: 'Hades',
        discord_aliases: ['Hades I', 'SuperGiant Hades'],
        steam_app_id: '1145360',
        gog_id: '1207659145',
        epic_id: 'hades-epic',
        xbox_app_id: 'BCRGV4FCDFL5',
        opencritic_id: '8483',
      });
      expect(c.eq).toHaveBeenCalledWith('id', 'game-1');
    });

    it('omits null fields from the update — never clobbers a curated value', async () => {
      const c = chain({ data: null, error: null });
      from.mockReturnValue(c);

      await service.applyDiscordData('game-1', {
        ...fullData,
        steam_app_id: null,
        gog_id: null,
        epic_id: null,
      });

      const updateArg = c.update.mock.calls[0][0];
      expect(updateArg).not.toHaveProperty('steam_app_id');
      expect(updateArg).not.toHaveProperty('gog_id');
      expect(updateArg).not.toHaveProperty('epic_id');
      // Other fields still present
      expect(updateArg).toHaveProperty('discord_name', 'Hades');
      expect(updateArg).toHaveProperty('xbox_app_id', 'BCRGV4FCDFL5');
    });

    it('omits empty aliases array (length 0 is treated as no value)', async () => {
      const c = chain({ data: null, error: null });
      from.mockReturnValue(c);

      await service.applyDiscordData('game-1', { ...fullData, aliases: [] });

      const updateArg = c.update.mock.calls[0][0];
      expect(updateArg).not.toHaveProperty('discord_aliases');
    });

    it('skips the DB call entirely when nothing in `data` is populated', async () => {
      const c = chain({ data: null, error: null });
      from.mockReturnValue(c);

      await service.applyDiscordData('game-1', {
        id: '12345',
        name: '',
        description: null,
        type: 0,
        icon: null,
        cover_image: null,
        aliases: [],
        igdb_id: null,
        steam_app_id: null,
        gog_id: null,
        epic_id: null,
        xbox_app_id: null,
        opencritic_id: null,
      });

      expect(from).not.toHaveBeenCalled();
    });

    it('logs (does not throw) when the update errors', async () => {
      from.mockReturnValue(chain({ data: null, error: { message: 'rls denied' } }));

      await expect(
        service.applyDiscordData('game-1', fullData),
      ).resolves.toBeUndefined();
    });
  });

  describe('createMinimal — slug regex pipeline + timestamp suffix', () => {
    let nowSpy: jest.SpyInstance;

    afterEach(() => {
      nowSpy?.mockRestore();
    });

    const insertedRow = {
      id: 'uuid-1',
      name: 'Whatever',
      slug: 'placeholder',
      cover_url: null,
      igdb_id: null,
    };

    it('lowercases, strips punctuation, collapses whitespace and hyphens, then appends Date.now()', async () => {
      nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
      const c = chain({ data: insertedRow, error: null });
      from.mockReturnValue(c);

      await service.createMinimal("Assassin's Creed: Valhalla --  Edition!");

      const insertArg = c.insert.mock.calls[0][0];
      // Expected: punctuation gone, multi-spaces and hyphen runs collapsed,
      // suffix is the frozen Date.now() value.
      expect(insertArg.slug).toBe(
        'assassins-creed-valhalla-edition-1700000000000',
      );
      expect(insertArg.name).toBe(
        "Assassin's Creed: Valhalla --  Edition!",
      );
      expect(insertArg.metadata_source).toBe('discord');
    });

    it('returns the inserted row on success', async () => {
      const c = chain({ data: insertedRow, error: null });
      from.mockReturnValue(c);

      const result = await service.createMinimal('Hades');

      expect(result).toEqual(insertedRow);
    });

    it('throws when the insert fails', async () => {
      const c = chain({ data: null, error: { message: 'unique violation' } });
      from.mockReturnValue(c);

      await expect(service.createMinimal('Hades')).rejects.toMatchObject({
        message: 'unique violation',
      });
    });
  });

  describe('setApplicationId — only writes when discord_application_id is null', () => {
    it('issues update with .is(discord_application_id, null) guard', async () => {
      const c = chain({ data: null, error: null });
      from.mockReturnValue(c);

      await service.setApplicationId('game-1', 'app-123');

      expect(from).toHaveBeenCalledWith('games');
      expect(c.update).toHaveBeenCalledWith({
        discord_application_id: 'app-123',
      });
      expect(c.eq).toHaveBeenCalledWith('id', 'game-1');
      expect(c.is).toHaveBeenCalledWith('discord_application_id', null);
    });

    it('logs (does not throw) when the update conflicts on the unique constraint', async () => {
      from.mockReturnValue(
        chain({
          data: null,
          error: { message: 'duplicate key value violates unique constraint' },
        }),
      );

      await expect(
        service.setApplicationId('game-1', 'app-123'),
      ).resolves.toBeUndefined();
    });
  });

  describe('setDiscordNameIfMissing — fallback when the resolver lacks RPC data', () => {
    it('issues update with .is(discord_name, null) guard', async () => {
      const c = chain({ data: null, error: null });
      from.mockReturnValue(c);

      await service.setDiscordNameIfMissing('game-1', 'Above the Snow');

      expect(c.update).toHaveBeenCalledWith({ discord_name: 'Above the Snow' });
      expect(c.eq).toHaveBeenCalledWith('id', 'game-1');
      expect(c.is).toHaveBeenCalledWith('discord_name', null);
    });

    it('logs (does not throw) on update failure', async () => {
      from.mockReturnValue(
        chain({ data: null, error: { message: 'rls denied' } }),
      );

      await expect(
        service.setDiscordNameIfMissing('game-1', 'X'),
      ).resolves.toBeUndefined();
    });
  });
});
