-- Add role column to profiles for admin auth gating
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Admin platform overview RPC function
CREATE OR REPLACE FUNCTION public.get_admin_platform_overview()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'dau', (SELECT count(DISTINCT user_id) FROM public.game_sessions WHERE started_at >= CURRENT_DATE),
    'wau', (SELECT count(DISTINCT user_id) FROM public.game_sessions WHERE started_at >= date_trunc('week', CURRENT_DATE)),
    'mau', (SELECT count(DISTINCT user_id) FROM public.game_sessions WHERE started_at >= date_trunc('month', CURRENT_DATE)),
    'active_sessions', (SELECT count(*) FROM public.game_sessions WHERE ended_at IS NULL),
    'sessions_today', (SELECT count(*) FROM public.game_sessions WHERE started_at >= CURRENT_DATE),
    'total_games', (SELECT count(*) FROM public.games WHERE ignored = false),
    'total_sessions', (SELECT count(*) FROM public.game_sessions),
    'total_playtime_secs', (SELECT COALESCE(sum(duration_secs), 0) FROM public.game_sessions),
    'signups_today', (SELECT count(*) FROM public.profiles WHERE created_at >= CURRENT_DATE),
    'signups_this_week', (SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('week', CURRENT_DATE)),
    'discord_connected', (SELECT count(*) FROM public.profiles WHERE discord_id IS NOT NULL),
    'in_guild_count', (SELECT count(*) FROM public.profiles WHERE in_guild = true)
  ) INTO result;
  RETURN result;
END;
$$;
