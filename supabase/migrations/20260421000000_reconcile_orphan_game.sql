-- Reconcile an orphan game row (igdb_id IS NULL) with fresh IGDB data.
--
-- Orphans are created by the resolver's Tier 5 fallback when IGDB is
-- unreachable during a session start. Once IGDB recovers, the
-- ReconciliationService cron job calls this function for each orphan.
--
-- Called by: apps/backend/src/games/reconciliation.service.ts
-- Issue: #39
--
-- The function has two branches:
--
--   (a) No canonical row exists yet for the IGDB id → enrich the orphan
--       in place by updating its metadata. Foreign keys stay intact, so
--       any active game_sessions pointing at the orphan continue to work
--       uninterrupted. This is the common case.
--
--   (b) A canonical row already exists for the IGDB id (another user
--       resolved the same game via a different presence string) → merge
--       the orphan into the canonical row. All dependents (game_sessions,
--       user_games, user_game_library) get repointed; user_games stats
--       sum together; user_game_library dedupes on (user_id, game_id);
--       the orphan is deleted.
--
-- The dedup branch is wrapped in an implicit transaction — all-or-nothing.
-- If anything fails, the orphan and its dependents remain untouched and
-- the next cron run retries. The returned jsonb lets the caller log /
-- observe which branch fired.
--
-- Returns: {action: 'enriched'|'deduped'|'no_match', canonical_id: uuid|null}

CREATE OR REPLACE FUNCTION public.reconcile_orphan_game(
  p_orphan_id uuid,
  p_igdb_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_igdb_id integer;
  v_canonical_id uuid;
  v_first_release_date timestamptz;
BEGIN
  v_igdb_id := nullif(p_igdb_data->>'igdb_id', '')::integer;

  -- (c) No IGDB match means we have nothing to reconcile against. Leave the
  --     orphan as-is; caller logs and moves on.
  IF v_igdb_id IS NULL THEN
    RETURN jsonb_build_object('action', 'no_match', 'canonical_id', NULL);
  END IF;

  -- Look for an existing canonical row. Excludes the orphan itself on the
  -- odd chance the caller already set the igdb_id.
  SELECT id INTO v_canonical_id
  FROM public.games
  WHERE igdb_id = v_igdb_id
    AND id <> p_orphan_id
  LIMIT 1;

  v_first_release_date := nullif(p_igdb_data->>'first_release_date', '')::timestamptz;

  -- (a) Enrich in place — no canonical yet, so just update the orphan row
  --     with the full metadata.
  IF v_canonical_id IS NULL THEN
    UPDATE public.games
    SET
      igdb_id           = v_igdb_id,
      -- Update non-null fields; keep existing value if IGDB didn't supply.
      slug              = coalesce(p_igdb_data->>'slug', slug),
      name              = coalesce(p_igdb_data->>'name', name),
      cover_url         = coalesce(p_igdb_data->>'cover_url', cover_url),
      genres            = coalesce(
                            ARRAY(SELECT jsonb_array_elements_text(p_igdb_data->'genres')),
                            genres
                          ),
      developer         = coalesce(p_igdb_data->>'developer', developer),
      publisher         = coalesce(p_igdb_data->>'publisher', publisher),
      release_year      = coalesce(nullif(p_igdb_data->>'release_year', '')::integer, release_year),
      description       = coalesce(p_igdb_data->>'description', description),
      first_release_date = coalesce(v_first_release_date, first_release_date),
      screenshots       = coalesce(
                            ARRAY(SELECT jsonb_array_elements_text(p_igdb_data->'screenshots')),
                            screenshots
                          ),
      artwork_url       = coalesce(p_igdb_data->>'artwork_url', artwork_url),
      rating            = coalesce(nullif(p_igdb_data->>'rating', '')::numeric, rating),
      rating_count      = coalesce(nullif(p_igdb_data->>'rating_count', '')::integer, rating_count),
      platforms         = coalesce(
                            ARRAY(SELECT jsonb_array_elements_text(p_igdb_data->'platforms')),
                            platforms
                          ),
      metadata_source   = 'igdb',
      igdb_updated_at   = now()
    WHERE id = p_orphan_id;

    RETURN jsonb_build_object('action', 'enriched', 'canonical_id', p_orphan_id);
  END IF;

  -- (b) Dedup — repoint dependents at the canonical row, then delete the
  --     orphan. Ordering is important because of the unique constraints on
  --     (user_id, game_id) in user_games and user_game_library.

  -- 1. game_sessions — no unique constraint on game_id, straight update.
  --    Active sessions (ended_at IS NULL) get repointed silently; next
  --    heartbeat / session-end trigger will operate against the canonical
  --    row without the user noticing anything changed.
  UPDATE public.game_sessions
  SET game_id = v_canonical_id
  WHERE game_id = p_orphan_id;

  -- 2. user_games — UNIQUE(user_id, game_id). Merge stats for any user
  --    that has BOTH an orphan row and a canonical row.
  INSERT INTO public.user_games AS canonical
    (user_id, game_id, total_time_secs, total_sessions, avg_session_secs, first_played, last_played)
  SELECT
    orphan.user_id,
    v_canonical_id,
    orphan.total_time_secs,
    orphan.total_sessions,
    orphan.avg_session_secs,
    orphan.first_played,
    orphan.last_played
  FROM public.user_games orphan
  WHERE orphan.game_id = p_orphan_id
  ON CONFLICT (user_id, game_id) DO UPDATE SET
    total_time_secs  = canonical.total_time_secs + EXCLUDED.total_time_secs,
    total_sessions   = canonical.total_sessions + EXCLUDED.total_sessions,
    avg_session_secs = CASE
      WHEN canonical.total_sessions + EXCLUDED.total_sessions > 0
      THEN (canonical.total_time_secs + EXCLUDED.total_time_secs)
           / (canonical.total_sessions + EXCLUDED.total_sessions)
      ELSE 0
    END,
    first_played = LEAST(canonical.first_played, EXCLUDED.first_played),
    last_played  = GREATEST(canonical.last_played, EXCLUDED.last_played);

  -- Now remove the orphan user_games rows — their stats have been merged.
  DELETE FROM public.user_games WHERE game_id = p_orphan_id;

  -- 3. user_game_library — UNIQUE(user_id, game_id). If a user has both
  --    orphan and canonical library rows, keep the canonical one (it
  --    likely has better status / notes) and drop the orphan's.
  DELETE FROM public.user_game_library AS orphan
  USING public.user_game_library AS canonical
  WHERE orphan.game_id = p_orphan_id
    AND canonical.game_id = v_canonical_id
    AND canonical.user_id = orphan.user_id;

  -- Remaining orphan library rows have no conflict — repoint them.
  UPDATE public.user_game_library
  SET game_id = v_canonical_id
  WHERE game_id = p_orphan_id;

  -- 4. Delete the orphan. All FK dependents have been repointed or merged,
  --    so the NO ACTION constraints won't block this. If something slipped
  --    through, the DELETE raises foreign_key_violation and the whole
  --    function rolls back — the orphan stays intact for the next run.
  DELETE FROM public.games WHERE id = p_orphan_id;

  RETURN jsonb_build_object('action', 'deduped', 'canonical_id', v_canonical_id);
END;
$$;

COMMENT ON FUNCTION public.reconcile_orphan_game IS
  'Reconcile an orphan games row (igdb_id IS NULL) with fresh IGDB data. '
  'Either enriches in place or deduplicates into an existing canonical row. '
  'Called by ReconciliationService cron every 5 minutes. See issue #39.';
