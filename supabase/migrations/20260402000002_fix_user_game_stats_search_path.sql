-- Fix update_user_game_stats() to use fully qualified public.user_games references.
-- Previously used unqualified "user_games" which broke when called from
-- SECURITY DEFINER functions with SET search_path = '' (e.g. close_session_returning).
-- Concept: Search Path Hijacking — SECURITY DEFINER functions should use empty
-- search_path to prevent schema injection, but all referenced tables must then
-- be fully qualified with their schema name.

CREATE OR REPLACE FUNCTION public.update_user_game_stats()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.game_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.games WHERE id = NEW.game_id AND ignored = true) THEN
    RETURN NEW;
  END IF;
  IF NEW.ended_at IS NOT NULL AND (OLD.ended_at IS NULL OR OLD.ended_at IS DISTINCT FROM NEW.ended_at) THEN
    INSERT INTO public.user_games (user_id, game_id, total_time_secs, total_sessions, first_played, last_played, avg_session_secs)
    VALUES (
      NEW.user_id, NEW.game_id,
      COALESCE(NEW.duration_secs, 0), 1,
      NEW.started_at, NEW.ended_at,
      COALESCE(NEW.duration_secs, 0)
    )
    ON CONFLICT (user_id, game_id)
    DO UPDATE SET
      total_time_secs = public.user_games.total_time_secs + COALESCE(NEW.duration_secs, 0),
      total_sessions = public.user_games.total_sessions + 1,
      last_played = NEW.ended_at,
      avg_session_secs = (public.user_games.total_time_secs + COALESCE(NEW.duration_secs, 0)) / (public.user_games.total_sessions + 1);
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.update_user_game_stats IS
  'Updates user_games aggregates when a game_sessions row gets an ended_at timestamp. Uses fully qualified table names for compatibility with SECURITY DEFINER callers.';
