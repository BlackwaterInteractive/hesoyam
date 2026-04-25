-- Drop unused user_game_library.notes column.
--
-- Background: column was defined in 20260127000000_resync_live_schema.sql
-- but is never written by mobile, backend, or web. The web dashboard's only
-- read of it (page.tsx) passed the value through a view-model object with no
-- UI surface. Removing as part of the admin Game Remap redesign (#154) so
-- the per-user library merge policy in `admin_merge_games` doesn't have to
-- consider notes-preservation in the rare both-sides-curated case.

alter table public.user_game_library
  drop column if exists notes;
