-- Function to roll back user_games stats when a session is reopened
-- (e.g., user toggled Discord presence off/on during same game launch)
CREATE OR REPLACE FUNCTION public.rollback_user_game_stats(
  p_user_id UUID,
  p_game_id UUID,
  p_duration_secs INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_games
  SET
    total_time_secs = GREATEST(total_time_secs - p_duration_secs, 0),
    total_sessions = GREATEST(total_sessions - 1, 0),
    avg_session_secs = CASE
      WHEN total_sessions - 1 > 0
        THEN GREATEST(total_time_secs - p_duration_secs, 0) / (total_sessions - 1)
      ELSE 0
    END
  WHERE user_id = p_user_id AND game_id = p_game_id;
END;
$$;
