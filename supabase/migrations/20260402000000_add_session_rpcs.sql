-- Session reopen: rolls back stats + reopens session in one transaction.
-- Fixes the fragile two-step pattern where rollback could succeed but reopen fails,
-- leaving user_games stats inconsistent.
-- Concept: Compensating Transaction - wrapping a multi-step undo+redo in a single
-- atomic operation to prevent partial state.
--
-- NOTE: CREATE FUNCTION is wrapped in a DO block because the Supabase CLI's
-- migration applier mis-parses multi-statement files when any identifier
-- contains the token ATOMIC (PG 14+ BEGIN ATOMIC keyword). Wrapping in DO
-- with dynamic SQL hides the identifier from the naive splitter.

DO $outer$
BEGIN
  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION public.reopen_session_atomic(
      p_session_id UUID,
      p_user_id UUID,
      p_game_id UUID
    ) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $body$
    DECLARE
      v_duration INTEGER;
    BEGIN
      SELECT duration_secs INTO v_duration
      FROM public.game_sessions
      WHERE id = p_session_id;

      IF v_duration IS NULL THEN
        RAISE EXCEPTION 'Session not found: %', p_session_id;
      END IF;

      UPDATE public.user_games
      SET total_sessions = GREATEST(total_sessions - 1, 0),
          total_time_secs = GREATEST(total_time_secs - v_duration, 0),
          avg_session_secs = CASE
            WHEN total_sessions - 1 > 0
            THEN GREATEST(total_time_secs - v_duration, 0) / (total_sessions - 1)
            ELSE 0
          END
      WHERE user_id = p_user_id AND game_id = p_game_id;

      UPDATE public.game_sessions
      SET ended_at = NULL,
          duration_secs = 0,
          active_secs = 0,
          idle_secs = 0,
          updated_at = now()
      WHERE id = p_session_id;
    END;
    $body$;
  $ddl$;

  EXECUTE $c$
    COMMENT ON FUNCTION public.reopen_session_atomic IS
      'Rolls back user_games stats and reopens a closed session in one transaction. Used when Discord presence flickers and the same game launch is detected.'
  $c$;
END
$outer$;


-- Single atomic close: replaces the SELECT-then-UPDATE pattern with one operation.
-- Returns the closed session row so the caller has all details without a second query.

CREATE OR REPLACE FUNCTION public.close_session_returning(
  p_user_id UUID,
  p_source TEXT DEFAULT NULL
) RETURNS SETOF public.game_sessions
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.game_sessions
  SET ended_at = now(),
      duration_secs = EXTRACT(EPOCH FROM (now() - started_at))::int,
      active_secs = EXTRACT(EPOCH FROM (now() - started_at))::int,
      idle_secs = 0,
      updated_at = now()
  WHERE user_id = p_user_id
    AND ended_at IS NULL
    AND (p_source IS NULL OR source = p_source)
  RETURNING *;
$$;

COMMENT ON FUNCTION public.close_session_returning IS
  'Closes the active session for a user in a single UPDATE RETURNING. Optionally filters by source (discord/agent).';
