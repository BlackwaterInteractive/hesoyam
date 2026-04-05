-- Add discord_application_id to games table for precise game identification.
-- Discord provides a unique application ID per game in presence data.
-- This allows the resolver to match by applicationId first (instant, unambiguous)
-- before falling back to name-based matching (which can pick the wrong IGDB game
-- when multiple games share the same name, e.g. "Deadlock").

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS discord_application_id TEXT UNIQUE;

COMMENT ON COLUMN public.games.discord_application_id IS
  'Discord application ID (snowflake) for precise game identification. Set automatically by the resolver on first play, or manually via game correction.';
