-- SteamGridDB asset enrichment columns on public.games.
--
-- Adds curated artwork URLs (icon, logo, hero, grid) sourced from SteamGridDB
-- or manually uploaded by an admin, then re-hosted on our ImageKit account.
-- All URL columns hold ImageKit URLs, not raw SteamGridDB CDN URLs — this gives
-- us reliability (community uploads can disappear), free transformations, and
-- a clean migration path off ImageKit later.
--
-- assets_enriched is the canonical "is this game enriched?" flag.
-- curated_at / curated_by stay as audit metadata.

alter table public.games
  add column steamgriddb_game_id     bigint,
  add column steamgriddb_icon_url    text,
  add column steamgriddb_logo_url    text,
  add column steamgriddb_hero_url    text,
  add column steamgriddb_grid_url    text,
  add column assets_enriched         boolean not null default false,
  add column curated_at              timestamptz,
  add column curated_by              uuid references public.profiles(id);

create index if not exists idx_games_steamgriddb_id
  on public.games(steamgriddb_game_id);

create index if not exists idx_games_needs_enrichment
  on public.games(assets_enriched)
  where assets_enriched = false;
