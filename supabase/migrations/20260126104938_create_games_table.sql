create table public.games (
  id uuid primary key default gen_random_uuid(),
  igdb_id integer unique,
  name text not null,
  slug text unique not null,
  cover_url text,
  genres text[] default '{}',
  developer text,
  release_year integer,
  created_at timestamptz not null default now()
);

create index games_slug_idx on public.games (slug);
create index games_name_idx on public.games using gin (name gin_trgm_ops);
