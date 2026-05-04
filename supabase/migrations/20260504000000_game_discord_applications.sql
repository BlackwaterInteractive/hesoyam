-- Federate Discord application IDs to a single game (issue #194).
--
-- The current `games.discord_application_id text UNIQUE` column bakes "one
-- game = one Discord ID" into the schema. Reality is 1:N — a single game
-- can have multiple registered Discord application IDs (companion bots,
-- launchers, regional variants, demos). The 1:1 column fragmented `games`
-- rows, sessions, and library entries across what users experienced as
-- one game (concrete incident: Delta Force, 2026-05-04).
--
-- This migration moves the fact "Discord app id X belongs to game G" into
-- its own table with a PK on `application_id`, making "one app id → at
-- most one game" a database-enforced invariant. The resolver federates
-- via this table; multiple ids accumulate over time, seeded both by
-- direct presence events and by Discord's `linked_games` field on the
-- /applications/{id}/rpc response.
--
-- Concept: External Identity Federation (docs-hesoyam/til/concepts.md).
--
-- Migration shape (single-shot):
--   1. Create `game_discord_applications`.
--   2. Backfill from `games.discord_application_id`.
--   3. Drop the column. All readers updated in the same PR.

create table public.game_discord_applications (
  application_id text primary key,
  game_id        uuid not null references public.games(id) on delete cascade
);

create index game_discord_applications_game_id_idx
  on public.game_discord_applications (game_id);

comment on table public.game_discord_applications is
  'Federation table mapping Discord application IDs to canonical games. PK on application_id makes "one Discord id → at most one game" a DB-enforced invariant. Multiple rows per game_id are expected (game has launcher, companion, regional variants, etc).';
comment on column public.game_discord_applications.application_id is
  'Discord application ID (snowflake). Globally unique — Discord guarantees uniqueness across all registered apps.';
comment on column public.game_discord_applications.game_id is
  'FK to games.id. Cascades on game delete so junction rows never dangle.';

-- Backfill: every existing non-null discord_application_id becomes a
-- junction row. ON CONFLICT defends against duplicate values that may
-- have slipped past the old column's UNIQUE constraint via race (the
-- exact failure mode we're fixing).
insert into public.game_discord_applications (application_id, game_id)
  select discord_application_id, id
    from public.games
   where discord_application_id is not null
  on conflict (application_id) do nothing;

-- Drop the old column. UNIQUE index goes with it. All app-side readers
-- (apps/backend, apps/admin, apps/web) updated in the same PR.
alter table public.games
  drop column if exists discord_application_id;
