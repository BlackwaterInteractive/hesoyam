-- Migration: Add Discord Rich Presence Tracking Support
-- This migration adds fields for Discord RP tracking and enforces
-- one active session per user.

-- ============================================================================
-- 1. Add Discord connection fields to profiles
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discord_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS discord_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agent_last_seen TIMESTAMPTZ;

-- Index for faster lookup by discord_id
CREATE INDEX IF NOT EXISTS idx_profiles_discord_id
  ON public.profiles(discord_id)
  WHERE discord_id IS NOT NULL;

-- ============================================================================
-- 2. Add source field to game_sessions
-- ============================================================================

-- Add source column to track where sessions came from
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'agent';

-- Add check constraint for valid sources
ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_source_check
  CHECK (source IN ('agent', 'discord'));

-- ============================================================================
-- 3. Enforce one active session per user
-- ============================================================================

-- Unique partial index: only one session per user can have ended_at = NULL
-- This prevents duplicate active sessions at the database level
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_active_session
  ON public.game_sessions(user_id)
  WHERE ended_at IS NULL;

-- ============================================================================
-- 4. Add game_name field for Discord sessions
-- ============================================================================

-- Discord RP provides game name directly, may not match our games table
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS game_name TEXT;

-- ============================================================================
-- 5. Update RLS policies for new fields
-- ============================================================================

-- Allow users to read their own discord_id
-- (profiles already have SELECT policy, no change needed)

-- Allow users to update their discord_id (only once, enforced in app)
-- The existing UPDATE policy allows users to update their own profile

-- ============================================================================
-- 6. Enable realtime for profiles discord_id changes
-- ============================================================================

-- The profiles table should already be in the realtime publication
-- If not, this will add it:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- ============================================================================
-- 7. Comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.profiles.discord_id IS
  'Discord user ID for Rich Presence tracking. Immutable once set.';

COMMENT ON COLUMN public.profiles.discord_connected_at IS
  'Timestamp when Discord was connected';

COMMENT ON COLUMN public.profiles.agent_last_seen IS
  'Last heartbeat from desktop agent. Used for agent priority detection.';

COMMENT ON COLUMN public.game_sessions.source IS
  'Which tracking system created this session: agent or discord';

COMMENT ON COLUMN public.game_sessions.game_name IS
  'Game name from Discord RP. May differ from games table name.';

COMMENT ON INDEX public.unique_user_active_session IS
  'Ensures only one active (non-ended) session per user at any time';
