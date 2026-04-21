import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { IgdbService, IgdbGameData } from '../igdb/igdb.service';
import { SupabaseService } from '../core/supabase/supabase.service';
import { ReconciliationService } from './reconciliation.service';

/**
 * Covers the orphan-reconciliation worker added for #39.
 *
 * The actual enrich / dedup logic lives in the `reconcile_orphan_game` SQL
 * function — these tests cover the TypeScript orchestration:
 *   - finds orphans with the right filters
 *   - searches IGDB and picks the best match
 *   - passes the right payload to the SQL function
 *   - handles no_match / enriched / deduped branches
 *   - isolates failures (one orphan failing doesn't poison the rest)
 */
describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let rpc: jest.Mock;
  let from: jest.Mock;
  let queryChain: {
    select: jest.Mock;
    is: jest.Mock;
    eq: jest.Mock;
    lt: jest.Mock;
    order: jest.Mock;
    limit: jest.Mock;
  };
  let igdb: {
    search: jest.Mock;
    fetchGameData: jest.Mock;
  };

  const noopLogger = () => ({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  });

  const makeIgdbData = (overrides: Partial<IgdbGameData> = {}): IgdbGameData => ({
    igdb_id: 25076,
    name: 'Red Dead Redemption 2',
    slug: 'red-dead-redemption-2',
    cover_url: null,
    genres: ['Shooter', 'Adventure'],
    developer: null,
    publisher: null,
    release_year: 2018,
    description: null,
    first_release_date: '2018-10-26T00:00:00.000Z',
    screenshots: [],
    artwork_url: null,
    rating: null,
    rating_count: null,
    platforms: [],
    ...overrides,
  });

  beforeEach(async () => {
    // Supabase query builder chain — every method returns `this` except
    // the final `limit` which returns { data, error }.
    queryChain = {
      select: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };
    from = jest.fn().mockReturnValue(queryChain);
    rpc = jest.fn();

    igdb = {
      search: jest.fn(),
      fetchGameData: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({ from, rpc }),
          },
        },
        { provide: IgdbService, useValue: igdb },
        {
          provide: getLoggerToken(ReconciliationService.name),
          useValue: noopLogger(),
        },
      ],
    }).compile();

    service = moduleRef.get(ReconciliationService);
  });

  // ── Orphan selection ───────────────────────────────────────────────────

  it('skips the sweep when no orphans exist', async () => {
    queryChain.limit.mockResolvedValueOnce({ data: [], error: null });

    await service.reconcileOrphans();

    expect(igdb.search).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('queries orphans with the right filters', async () => {
    queryChain.limit.mockResolvedValueOnce({ data: [], error: null });

    await service.reconcileOrphans();

    expect(from).toHaveBeenCalledWith('games');
    expect(queryChain.select).toHaveBeenCalledWith('id, name');
    expect(queryChain.is).toHaveBeenCalledWith('igdb_id', null);
    expect(queryChain.eq).toHaveBeenCalledWith('ignored', false);
    // `lt('created_at', someTimestamp)` — the grace-period filter
    expect(queryChain.lt).toHaveBeenCalledWith('created_at', expect.any(String));
    expect(queryChain.limit).toHaveBeenCalledWith(50);
  });

  // ── Happy paths ────────────────────────────────────────────────────────

  it('enriches when IGDB has a match and no canonical exists', async () => {
    queryChain.limit.mockResolvedValueOnce({
      data: [{ id: 'orphan-1', name: 'RDR2' }],
      error: null,
    });
    igdb.search.mockResolvedValueOnce([
      { id: 25076, name: 'Red Dead Redemption 2' },
    ]);
    const igdbData = makeIgdbData();
    igdb.fetchGameData.mockResolvedValueOnce(igdbData);
    rpc.mockResolvedValueOnce({
      data: { action: 'enriched', canonical_id: 'orphan-1' },
      error: null,
    });

    await service.reconcileOrphans();

    expect(igdb.search).toHaveBeenCalledWith('RDR2', 5);
    expect(igdb.fetchGameData).toHaveBeenCalledWith(25076);
    expect(rpc).toHaveBeenCalledWith('reconcile_orphan_game', {
      p_orphan_id: 'orphan-1',
      p_igdb_data: igdbData,
    });
  });

  it('prefers an exact-name IGDB match over the first result', async () => {
    queryChain.limit.mockResolvedValueOnce({
      data: [{ id: 'orphan-1', name: 'Hades' }],
      error: null,
    });
    // IGDB's default ordering puts "Hades II" first, but we should pick the
    // one whose name matches the orphan exactly (case-insensitive).
    igdb.search.mockResolvedValueOnce([
      { id: 999999, name: 'Hades II' },
      { id: 113112, name: 'Hades' },
    ]);
    igdb.fetchGameData.mockResolvedValueOnce(makeIgdbData({ igdb_id: 113112 }));
    rpc.mockResolvedValueOnce({
      data: { action: 'enriched', canonical_id: 'orphan-1' },
      error: null,
    });

    await service.reconcileOrphans();

    expect(igdb.fetchGameData).toHaveBeenCalledWith(113112);
  });

  it('falls back to the first result when no exact-name match exists', async () => {
    queryChain.limit.mockResolvedValueOnce({
      data: [{ id: 'orphan-1', name: 'RDR2' }],
      error: null,
    });
    igdb.search.mockResolvedValueOnce([
      { id: 25076, name: 'Red Dead Redemption 2' },
    ]);
    igdb.fetchGameData.mockResolvedValueOnce(makeIgdbData());
    rpc.mockResolvedValueOnce({
      data: { action: 'enriched', canonical_id: 'orphan-1' },
      error: null,
    });

    await service.reconcileOrphans();

    expect(igdb.fetchGameData).toHaveBeenCalledWith(25076);
  });

  it('dedupes when IGDB match already has a canonical row', async () => {
    queryChain.limit.mockResolvedValueOnce({
      data: [{ id: 'orphan-1', name: 'RDR2' }],
      error: null,
    });
    igdb.search.mockResolvedValueOnce([
      { id: 25076, name: 'Red Dead Redemption 2' },
    ]);
    igdb.fetchGameData.mockResolvedValueOnce(makeIgdbData());
    rpc.mockResolvedValueOnce({
      data: { action: 'deduped', canonical_id: 'canonical-1' },
      error: null,
    });

    const result = await service.reconcileOne({
      id: 'orphan-1',
      name: 'RDR2',
    });

    expect(result).toEqual({
      action: 'deduped',
      canonical_id: 'canonical-1',
    });
  });

  // ── No-match path ──────────────────────────────────────────────────────

  it('passes an empty payload when IGDB returns zero results', async () => {
    queryChain.limit.mockResolvedValueOnce({
      data: [{ id: 'orphan-1', name: 'Obscure Indie Game' }],
      error: null,
    });
    igdb.search.mockResolvedValueOnce([]);
    rpc.mockResolvedValueOnce({
      data: { action: 'no_match', canonical_id: null },
      error: null,
    });

    await service.reconcileOrphans();

    // fetchGameData should NOT be called when there's no match
    expect(igdb.fetchGameData).not.toHaveBeenCalled();
    // The RPC still fires, but with an empty payload — SQL function returns no_match
    expect(rpc).toHaveBeenCalledWith('reconcile_orphan_game', {
      p_orphan_id: 'orphan-1',
      p_igdb_data: {},
    });
  });

  // ── Isolation ──────────────────────────────────────────────────────────

  it('one orphan failing does not poison the rest of the batch', async () => {
    queryChain.limit.mockResolvedValueOnce({
      data: [
        { id: 'orphan-1', name: 'A' },
        { id: 'orphan-2', name: 'B' },
        { id: 'orphan-3', name: 'C' },
      ],
      error: null,
    });

    // orphan-1: IGDB search throws
    igdb.search.mockRejectedValueOnce(new Error('IGDB timeout'));
    // orphan-2: succeeds
    igdb.search.mockResolvedValueOnce([{ id: 100, name: 'B' }]);
    igdb.fetchGameData.mockResolvedValueOnce(
      makeIgdbData({ igdb_id: 100, name: 'B', slug: 'b' }),
    );
    rpc.mockResolvedValueOnce({
      data: { action: 'enriched', canonical_id: 'orphan-2' },
      error: null,
    });
    // orphan-3: succeeds
    igdb.search.mockResolvedValueOnce([{ id: 200, name: 'C' }]);
    igdb.fetchGameData.mockResolvedValueOnce(
      makeIgdbData({ igdb_id: 200, name: 'C', slug: 'c' }),
    );
    rpc.mockResolvedValueOnce({
      data: { action: 'deduped', canonical_id: 'canonical-c' },
      error: null,
    });

    await service.reconcileOrphans();

    // All three were attempted; only orphan-1 failed.
    expect(igdb.search).toHaveBeenCalledTimes(3);
    // Only orphan-2 and orphan-3 reached fetchGameData + rpc.
    expect(igdb.fetchGameData).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('surfaces the Supabase error when orphan query itself fails', async () => {
    queryChain.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB unavailable' },
    });

    await expect(service.reconcileOrphans()).rejects.toMatchObject({
      message: 'DB unavailable',
    });
  });
});
