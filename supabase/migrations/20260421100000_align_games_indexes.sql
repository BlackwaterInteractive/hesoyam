-- Align the `games` table's index set between environments.
--
-- Background: staging was created from a consolidated snapshot migration
-- while production was built up incrementally over several months. The two
-- converged on 99% of schema but drifted on indexes:
--
--   - Prod had `idx_games_name_trgm` — a GIN trigram index on `games.name`.
--     This is **byte-identical** to the `games_name_idx` trigram index that
--     exists on both environments. A duplicate. Wastes disk and makes
--     every INSERT/UPDATE of games do one extra index write for no benefit.
--
--   - Staging has `idx_games_unmatched` — a partial btree used by
--     ReconciliationService to find orphan rows:
--       CREATE INDEX ... ON games (id) WHERE igdb_id IS NULL AND ignored = false
--     Prod lacks this, so the reconciliation cron's orphan query falls back
--     to a seqscan. Fine today on a small games table, becomes a problem
--     at scale.
--
-- This migration brings both envs to the same target state:
--   games_name_idx            (gin trigram on name)      ← canonical, both envs
--   idx_games_unmatched       (partial btree, ReconciliationService)
--
-- Idempotent on both envs — safe to re-run.

DROP INDEX IF EXISTS public.idx_games_name_trgm;

CREATE INDEX IF NOT EXISTS idx_games_unmatched
  ON public.games USING btree (id)
  WHERE igdb_id IS NULL AND ignored = false;
