-- Heal prod drift: add ignored-games filter to 4 remaining functions
--
-- Background: the `games.ignored` flag was introduced to let admins hide junk
-- entries (fake Discord activities, duplicates, etc.). Staging has filter
-- logic in every function that reads `public.games`; prod was missing it in
-- these four. Applying on staging is a no-op (CREATE OR REPLACE with
-- identical bodies); applying on prod heals the drift.
--
-- Not included (intentionally):
--   - handle_new_user: prod has newer/correct Discord OAuth logic; staging
--     is behind. Healing that is a separate staging-only follow-up.
--   - auto_add_to_library: only cosmetic difference (named vs bare
--     ON CONFLICT target). Functionally identical.

-- 1. Genre stats: exclude ignored games from the genre rollup.
create or replace function public.get_genre_stats(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  result json;
begin
  select json_agg(genre_data)
  into result
  from (
    select
      unnest(g.genres) as genre,
      sum(ug.total_time_secs) as total_secs
    from public.user_games ug
    join public.games g on g.id = ug.game_id
    where ug.user_id = p_user_id
      and g.genres is not null
      and array_length(g.genres, 1) > 0
      and g.ignored is not true
    group by unnest(g.genres)
    order by total_secs desc
  ) genre_data;
  return coalesce(result, '[]'::json);
end;
$function$;

-- 2. Session insert: don't create a user_games stub for ignored games.
create or replace function public.handle_session_insert()
returns trigger
language plpgsql
as $function$
begin
  if new.game_id is null then
    return new;
  end if;
  if exists (select 1 from public.games where id = new.game_id and ignored = true) then
    return new;
  end if;
  insert into user_games (user_id, game_id, total_time_secs, total_sessions, first_played, last_played, avg_session_secs)
  values (new.user_id, new.game_id, 0, 0, new.started_at, new.started_at, 0)
  on conflict (user_id, game_id) do nothing;
  return new;
end;
$function$;

-- 3. Fuzzy search: don't return ignored games.
create or replace function public.search_games_fuzzy(search_term text)
returns table(id uuid, name text, slug text, cover_url text)
language sql
stable
as $function$
  select g.id, g.name, g.slug, g.cover_url
  from public.games g
  where extensions.similarity(lower(g.name), lower(search_term)) > 0.75
    and g.ignored is not true
  order by extensions.similarity(lower(g.name), lower(search_term)) desc
  limit 1;
$function$;

-- 4. Library search: don't return ignored games.
create or replace function public.search_games_library(search_term text)
returns table(id uuid, name text, slug text, cover_url text, release_year integer, genres text[], igdb_id integer)
language sql
stable
set search_path = ''
as $function$
  select g.id, g.name, g.slug, g.cover_url, g.release_year, g.genres, g.igdb_id
  from public.games g
  where (extensions.similarity(lower(g.name), lower(search_term)) > 0.15
     or lower(g.name) like '%' || lower(search_term) || '%')
    and g.ignored is not true
  order by
    case when lower(g.name) like lower(search_term) || '%' then 0 else 1 end,
    extensions.similarity(lower(g.name), lower(search_term)) desc
  limit 10;
$function$;
