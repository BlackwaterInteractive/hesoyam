-- Backfill migration: catch-up for schema drift between repo and live DB.
--
-- Background: over the course of development, schema changes were applied directly
-- to staging/prod via the Supabase Studio / psql console without corresponding
-- migration files being committed. Result: the repo's migration chain cannot rebuild
-- the live DB from scratch, and the `reconcile_orphan_game` RPC (migration 20260421000000)
-- references tables/columns (`user_game_library`, `games.ignored`, etc.) that don't
-- exist in any prior migration.
--
-- This migration backfills everything that was applied out-of-band, so that:
--   1. `supabase db reset` on a fresh project produces a working DB
--   2. All downstream RPCs and triggers can resolve their dependencies
--   3. Applying to staging/prod is a no-op (objects already exist)
--
-- Fully idempotent — every statement uses `IF NOT EXISTS` or `DROP … IF EXISTS` first.
-- Tracked in issue #140.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles: missing columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists in_guild boolean not null default false;

alter table public.profiles
  add column if not exists password_set boolean default false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. games: missing columns (IGDB enrichment fields + ignored flag)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.games add column if not exists description        text;
alter table public.games add column if not exists publisher          text;
alter table public.games add column if not exists platforms          text[] not null default '{}';
alter table public.games add column if not exists screenshots        text[] not null default '{}';
alter table public.games add column if not exists artwork_url        text;
alter table public.games add column if not exists igdb_url           text;
alter table public.games add column if not exists rating             numeric;
alter table public.games add column if not exists rating_count       integer;
alter table public.games add column if not exists first_release_date timestamptz;
alter table public.games add column if not exists igdb_updated_at    timestamptz;
alter table public.games add column if not exists metadata_source    text not null default 'manual';
alter table public.games add column if not exists ignored            boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. user_game_library: mobile library feature + reconcile_orphan_game RPC
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_game_library (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id),
  game_id            uuid not null references public.games(id),
  status             text not null default 'played'
    check (status in ('want_to_play', 'played', 'completed')),
  notes              text,
  personal_rating    smallint check (personal_rating >= 1 and personal_rating <= 10),
  added_at           timestamptz not null default now(),
  status_changed_at  timestamptz not null default now(),
  unique (user_id, game_id)
);

create index if not exists idx_user_game_library_user_id
  on public.user_game_library (user_id);

create index if not exists idx_user_game_library_status
  on public.user_game_library (user_id, status);

alter table public.user_game_library enable row level security;

drop policy if exists "Users can view own library" on public.user_game_library;
create policy "Users can view own library"
  on public.user_game_library for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own library" on public.user_game_library;
create policy "Users can insert own library"
  on public.user_game_library for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own library" on public.user_game_library;
create policy "Users can update own library"
  on public.user_game_library for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own library" on public.user_game_library;
create policy "Users can delete own library"
  on public.user_game_library for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. system_config: admin-only runtime config (RLS disabled — accessed via service key)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.system_config (
  key         text primary key,
  value       jsonb not null,
  expires_at  timestamptz,
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. igdb_search_cache: legacy DB-backed IGDB search cache
--    NOTE: appears unused by current backend (superseded by in-process LRU in
--    igdb.service.ts). Included here to match live schema. Flagged for cleanup
--    in a future migration once confirmed safe to drop.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.igdb_search_cache (
  query      text primary key,
  results    jsonb not null,
  cached_at  timestamptz not null default now()
);

create index if not exists idx_igdb_search_cache_cached_at
  on public.igdb_search_cache (cached_at);
