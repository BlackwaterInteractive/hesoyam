import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../core/supabase/supabase.service';
import { IgdbService } from '../igdb/igdb.service';

interface OrphanRow {
  id: string;
  name: string;
}

interface ReconcileRpcResult {
  action: 'enriched' | 'deduped' | 'no_match';
  canonical_id: string | null;
}

/**
 * Sweeps orphan `games` rows (created by the resolver's Tier 5 fallback
 * when IGDB is unreachable) and reconciles them against fresh IGDB data.
 *
 * For each orphan:
 *   1. IGDB search on the orphan's raw name
 *   2. Call `reconcile_orphan_game` SQL function with the fetched metadata
 *      (function handles enrich-in-place vs dedup-into-canonical atomically)
 *   3. Log the outcome
 *
 * Concept: **reconciliation loop** — an out-of-band worker that re-converges
 * divergent state created under temporary failure. See issue #39.
 */
@Injectable()
export class ReconciliationService {
  // Cap per run to avoid long-running jobs and thundering the DB / IGDB if
  // the orphan list has grown large after a prolonged outage.
  private static readonly BATCH_SIZE = 50;
  // Give freshly-created rows a grace period before we try to reconcile —
  // avoids racing the resolver itself during transient IGDB errors.
  private static readonly MIN_AGE_MINUTES = 5;

  constructor(
    private supabase: SupabaseService,
    private igdb: IgdbService,
    @InjectPinoLogger(ReconciliationService.name) private logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'reconcile-orphan-games' })
  async reconcileOrphans(): Promise<void> {
    const orphans = await this.findOrphans();
    if (orphans.length === 0) return;

    this.logger.info(
      { orphanCount: orphans.length },
      'Starting orphan reconciliation sweep',
    );

    const tally = { enriched: 0, deduped: 0, noMatch: 0, failed: 0 };

    for (const orphan of orphans) {
      try {
        const result = await this.reconcileOne(orphan);
        switch (result.action) {
          case 'enriched':
            tally.enriched += 1;
            break;
          case 'deduped':
            tally.deduped += 1;
            break;
          case 'no_match':
            tally.noMatch += 1;
            break;
        }
      } catch (err) {
        tally.failed += 1;
        this.logger.warn(
          { err, orphanId: orphan.id, name: orphan.name },
          'Orphan reconciliation failed — will retry next run',
        );
      }
    }

    this.logger.info(tally, 'Orphan reconciliation sweep complete');
  }

  /**
   * Reconcile a single orphan. Exposed for testing / manual runs; the cron
   * calls through [reconcileOrphans].
   */
  async reconcileOne(orphan: OrphanRow): Promise<ReconcileRpcResult> {
    // 1. Search IGDB for the orphan's name.
    //    limit=5 so we can prefer exact-name matches the same way
    //    searchAndImport does — avoids picking a spin-off when the real
    //    game exists.
    const results = (await this.igdb.search(orphan.name, 5)) as Array<{
      id: number;
      name: string;
    }>;

    if (!results || results.length === 0) {
      const result = await this.callReconcileRpc(orphan.id, {});
      this.logger.debug(
        { orphanId: orphan.id, name: orphan.name },
        'IGDB returned no match for orphan',
      );
      return result;
    }

    const exact = results.find(
      (r) => r.name.toLowerCase() === orphan.name.toLowerCase(),
    );
    const bestMatch = exact ?? results[0];

    // 2. Fetch full metadata. `fetchGameData` doesn't write to the DB — the
    //    SQL function is responsible for persistence (atomically).
    const igdbData = await this.igdb.fetchGameData(bestMatch.id);

    // 3. Hand off to the SQL function. It decides enrich-vs-dedup.
    const result = await this.callReconcileRpc(orphan.id, igdbData);

    this.logger.info(
      {
        orphanId: orphan.id,
        orphanName: orphan.name,
        igdbId: igdbData.igdb_id,
        action: result.action,
        canonicalId: result.canonical_id,
      },
      'Orphan reconciled',
    );

    return result;
  }

  private async findOrphans(): Promise<OrphanRow[]> {
    const minAge = new Date(
      Date.now() - ReconciliationService.MIN_AGE_MINUTES * 60 * 1000,
    ).toISOString();

    const { data, error } = await this.supabase
      .getClient()
      .from('games')
      .select('id, name')
      .is('igdb_id', null)
      .eq('ignored', false)
      .lt('created_at', minAge)
      .order('created_at', { ascending: true })
      .limit(ReconciliationService.BATCH_SIZE);

    if (error) {
      this.logger.error({ error }, 'Failed to query orphan games');
      throw error;
    }

    return (data ?? []) as OrphanRow[];
  }

  private async callReconcileRpc(
    orphanId: string,
    igdbData: unknown,
  ): Promise<ReconcileRpcResult> {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('reconcile_orphan_game', {
        p_orphan_id: orphanId,
        p_igdb_data: igdbData,
      });

    if (error) {
      throw error;
    }

    return data as ReconcileRpcResult;
  }
}
