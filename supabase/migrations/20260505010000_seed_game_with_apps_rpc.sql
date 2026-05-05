-- RPC for the bulk-seed pipeline. Inserts a games row plus its federated
-- Discord application IDs in a single transaction.
--
-- Used by apps/backend/scripts/seed-games-dry-run.ts (dry run) and the
-- eventual full-catalog seed pipeline. SECURITY DEFINER + revoked from
-- public/anon/authenticated so only service_role callers can invoke it.

create or replace function public.seed_game_with_apps(
  p_game    jsonb,
  p_app_ids text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_app_id  text;
begin
  insert into public.games (
    name,
    slug,
    igdb_id,
    cover_url,
    genres,
    developer,
    release_year,
    description,
    publisher,
    platforms,
    screenshots,
    artwork_url,
    igdb_url,
    rating,
    rating_count,
    first_release_date,
    igdb_updated_at,
    metadata_source,
    discord_name,
    discord_aliases,
    steam_app_id,
    epic_id,
    xbox_app_id
  ) values (
    p_game->>'name',
    p_game->>'slug',
    nullif(p_game->>'igdb_id', '')::int,
    p_game->>'cover_url',
    coalesce(array(select jsonb_array_elements_text(p_game->'genres')),       '{}'::text[]),
    p_game->>'developer',
    nullif(p_game->>'release_year', '')::int,
    p_game->>'description',
    p_game->>'publisher',
    coalesce(array(select jsonb_array_elements_text(p_game->'platforms')),    '{}'::text[]),
    coalesce(array(select jsonb_array_elements_text(p_game->'screenshots')),  '{}'::text[]),
    p_game->>'artwork_url',
    p_game->>'igdb_url',
    nullif(p_game->>'rating', '')::numeric,
    nullif(p_game->>'rating_count', '')::int,
    nullif(p_game->>'first_release_date', '')::timestamptz,
    nullif(p_game->>'igdb_updated_at', '')::timestamptz,
    coalesce(p_game->>'metadata_source', 'manual'),
    p_game->>'discord_name',
    coalesce(array(select jsonb_array_elements_text(p_game->'discord_aliases')), '{}'::text[]),
    p_game->>'steam_app_id',
    p_game->>'epic_id',
    p_game->>'xbox_app_id'
  )
  returning id into v_game_id;

  foreach v_app_id in array p_app_ids loop
    insert into public.game_discord_applications (application_id, game_id)
    values (v_app_id, v_game_id);
  end loop;

  return v_game_id;
end;
$$;

revoke execute on function public.seed_game_with_apps(jsonb, text[])
  from public, anon, authenticated;
