-- Drop dependent index first
drop index if exists public.games_name_idx;

-- Move pg_trgm out of public schema
drop extension if exists pg_trgm;
create extension if not exists pg_trgm schema extensions;

-- Recreate the GIN index using the extensions schema
create index games_name_idx on public.games using gin (name extensions.gin_trgm_ops);
