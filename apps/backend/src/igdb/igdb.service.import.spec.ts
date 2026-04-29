import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getLoggerToken } from 'nestjs-pino';
import { of, throwError } from 'rxjs';
import { IgdbService } from './igdb.service';
import { TwitchAuthService } from './twitch-auth.service';
import { CacheService } from '../core/cache/cache.service';
import { SupabaseService } from '../core/supabase/supabase.service';

/**
 * Covers the import-side methods that complement the search() coverage in
 * igdb.service.spec.ts: fetchGameData (transformation), importById (upsert),
 * searchAndImport (best-match selection).
 */
describe('IgdbService — import-side methods', () => {
  let service: IgdbService;
  let httpPost: jest.Mock;
  let upsert: jest.Mock;
  let upsertSelect: jest.Mock;
  let upsertSingle: jest.Mock;

  const noopLogger = () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  });

  const buildService = async (): Promise<IgdbService> => {
    httpPost = jest.fn();

    upsertSingle = jest.fn();
    upsertSelect = jest.fn(() => ({ single: upsertSingle }));
    upsert = jest.fn(() => ({ select: upsertSelect }));
    const from = jest.fn(() => ({ upsert }));

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        IgdbService,
        CacheService,
        { provide: HttpService, useValue: { post: httpPost } },
        {
          provide: TwitchAuthService,
          useValue: {
            getAccessToken: jest.fn().mockResolvedValue('fake-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('fake-client-id'),
            get: <T>(_k: string, d: T): T => d,
          },
        },
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ from }) },
        },
        { provide: getLoggerToken(IgdbService.name), useValue: noopLogger() },
        { provide: getLoggerToken(CacheService.name), useValue: noopLogger() },
      ],
    }).compile();

    await moduleRef.init();
    return moduleRef.get(IgdbService);
  };

  beforeEach(async () => {
    service = await buildService();
  });

  describe('fetchGameData', () => {
    it('maps a fully-populated IGDB response to the IgdbGameData shape', async () => {
      // Unix timestamp for 2018-10-26 (RDR2 release)
      const releaseUnix = 1540512000;

      httpPost.mockReturnValue(
        of({
          data: [
            {
              name: 'Red Dead Redemption 2',
              slug: 'red-dead-redemption-2',
              cover: { image_id: 'co1q1f' },
              genres: [{ name: 'Adventure' }, { name: 'Shooter' }],
              involved_companies: [
                { developer: true, company: { name: 'Rockstar Games' } },
                { developer: false, company: { name: 'Take-Two' } },
              ],
              first_release_date: releaseUnix,
              summary: 'America, 1899.',
              screenshots: [{ image_id: 'sc1' }, { image_id: 'sc2' }],
              artworks: [{ image_id: 'ar1' }],
              total_rating: 92.4,
              total_rating_count: 1500,
              platforms: [{ name: 'PC' }, { name: 'PS5' }],
            },
          ],
        }),
      );

      const result = await service.fetchGameData(1942);

      expect(result).toEqual({
        igdb_id: 1942,
        name: 'Red Dead Redemption 2',
        slug: 'red-dead-redemption-2',
        cover_url:
          'https://images.igdb.com/igdb/image/upload/t_cover_big/co1q1f.jpg',
        genres: ['Adventure', 'Shooter'],
        developer: 'Rockstar Games',
        publisher: 'Take-Two',
        release_year: 2018,
        description: 'America, 1899.',
        first_release_date: new Date(releaseUnix * 1000).toISOString(),
        screenshots: [
          'https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc1.jpg',
          'https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc2.jpg',
        ],
        artwork_url:
          'https://images.igdb.com/igdb/image/upload/t_1080p/ar1.jpg',
        rating: 92.4,
        rating_count: 1500,
        platforms: ['PC', 'PS5'],
      });
    });

    it('distinguishes developer from publisher via the `developer` flag', async () => {
      httpPost.mockReturnValue(
        of({
          data: [
            {
              name: 'X',
              slug: 'x',
              involved_companies: [
                { developer: false, company: { name: 'PublisherCo' } },
                { developer: true, company: { name: 'DeveloperCo' } },
              ],
            },
          ],
        }),
      );
      const result = await service.fetchGameData(1);
      expect(result.developer).toBe('DeveloperCo');
      expect(result.publisher).toBe('PublisherCo');
    });

    it('returns nulls / empty arrays when nested fields are missing', async () => {
      httpPost.mockReturnValue(of({ data: [{ name: 'X', slug: 'x' }] }));

      const result = await service.fetchGameData(1);

      expect(result).toMatchObject({
        cover_url: null,
        genres: [],
        developer: null,
        publisher: null,
        release_year: null,
        description: null,
        first_release_date: null,
        screenshots: [],
        artwork_url: null,
        rating: null,
        rating_count: null,
        platforms: [],
      });
    });

    it('uses only the first artwork (not all of them)', async () => {
      httpPost.mockReturnValue(
        of({
          data: [
            {
              name: 'X',
              slug: 'x',
              artworks: [
                { image_id: 'first' },
                { image_id: 'second' },
                { image_id: 'third' },
              ],
            },
          ],
        }),
      );
      const result = await service.fetchGameData(1);
      expect(result.artwork_url).toBe(
        'https://images.igdb.com/igdb/image/upload/t_1080p/first.jpg',
      );
    });

    it('throws "IGDB game not found" when response.data is empty', async () => {
      httpPost.mockReturnValue(of({ data: [] }));
      await expect(service.fetchGameData(99999)).rejects.toThrow(
        'IGDB game not found: 99999',
      );
    });
  });

  describe('importById', () => {
    const igdbResponse = (overrides = {}) =>
      of({ data: [{ name: 'Game', slug: 'game', ...overrides }] });

    it('upserts the fetched data with onConflict on igdb_id', async () => {
      httpPost.mockReturnValue(igdbResponse());
      upsertSingle.mockResolvedValue({
        data: {
          id: 'uuid-1',
          name: 'Game',
          slug: 'game',
          cover_url: null,
          igdb_id: 42,
        },
        error: null,
      });

      const result = await service.importById(42);

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ igdb_id: 42, name: 'Game' }),
        { onConflict: 'igdb_id' },
      );
      expect(upsertSelect).toHaveBeenCalledWith(
        'id, name, slug, cover_url, igdb_id',
      );
      expect(result).toEqual({
        id: 'uuid-1',
        name: 'Game',
        slug: 'game',
        cover_url: null,
        igdb_id: 42,
      });
    });

    it('throws when Supabase returns an error', async () => {
      httpPost.mockReturnValue(igdbResponse());
      upsertSingle.mockResolvedValue({
        data: null,
        error: { message: 'duplicate slug' },
      });
      await expect(service.importById(42)).rejects.toMatchObject({
        message: 'duplicate slug',
      });
    });

    it('propagates fetchGameData errors (game not in IGDB)', async () => {
      httpPost.mockReturnValue(of({ data: [] }));
      await expect(service.importById(99999)).rejects.toThrow(
        'IGDB game not found: 99999',
      );
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe('searchAndImport', () => {
    let importByIdSpy: jest.SpyInstance;

    beforeEach(() => {
      importByIdSpy = jest
        .spyOn(service, 'importById')
        .mockResolvedValue({
          id: 'uuid-1',
          name: 'X',
          slug: 'x',
          cover_url: null,
          igdb_id: 1,
        });
    });

    it('returns null when search yields no results', async () => {
      httpPost.mockReturnValue(of({ data: [] }));
      const result = await service.searchAndImport('nonexistent');
      expect(result).toBeNull();
      expect(importByIdSpy).not.toHaveBeenCalled();
    });

    it('prefers the exact-name match over the first result (case-insensitive)', async () => {
      httpPost.mockReturnValue(
        of({
          data: [
            { id: 100, name: 'Hades II' },
            { id: 200, name: 'Hades' },
            { id: 300, name: 'Hades Stories' },
          ],
        }),
      );

      await service.searchAndImport('hades');

      expect(importByIdSpy).toHaveBeenCalledWith(200);
    });

    it('falls back to the first result when no exact-name match exists', async () => {
      httpPost.mockReturnValue(
        of({
          data: [
            { id: 100, name: 'Half-Life: Alyx' },
            { id: 200, name: 'Half-Life 2' },
          ],
        }),
      );

      await service.searchAndImport('half-life');

      expect(importByIdSpy).toHaveBeenCalledWith(100);
    });
  });
});
