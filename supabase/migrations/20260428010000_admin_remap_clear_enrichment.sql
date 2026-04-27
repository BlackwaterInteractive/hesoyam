-- Fold SteamGridDB enrichment clearing into admin_remap_apply and admin_merge_games.
--
-- Why: when a row's IGDB identity changes (clean_retarget or merge), any curated
-- SteamGridDB / manual-upload assets on that row are now art for the wrong game.
-- Leaving them in place would silently render the wrong cover/logo under the
-- corrected identity. Per PRD §5, the original plan was to fold this into #153
-- before the new columns existed; #153 shipped without it, so the fold-in lands
-- here alongside the column migration.
--
-- Refresh mode does NOT clear: identity isn't changing, just metadata refreshing.
--
-- ImageKit folder cleanup happens in the app layer (the remapGame server action)
-- because plpgsql can't call out to ImageKit. DB clears the row's URL columns;
-- app does best-effort deleteFolder('/games/{id}'). Together they keep DB and
-- ImageKit in sync.

create or replace function public.admin_remap_apply(
  p_source_id      uuid,
  p_target_igdb_id integer,
  p_metadata       jsonb,
  p_expected_mode  text,
  p_actor_id       uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_source_id_check    uuid;
  v_target_id          uuid;
  v_target_sessions    integer;
  v_target_user_games  integer;
  v_target_library     integer;
  v_actual_mode        text;
  v_deleted_target_id  uuid;
begin
  -- Lock source row for the transaction. Closes the TOCTOU window between
  -- plan and apply: anyone else trying to remap the same row waits.
  select id into v_source_id_check
    from public.games
    where id = p_source_id
    for update;

  if v_source_id_check is null then
    return jsonb_build_object('error', 'source_not_found');
  end if;

  -- Re-derive mode under the lock (mirrors admin_remap_plan).
  select id into v_target_id
    from public.games
    where igdb_id = p_target_igdb_id;

  if v_target_id is null then
    v_actual_mode := 'clean_retarget_no_target';
  elsif v_target_id = p_source_id then
    v_actual_mode := 'refresh';
  else
    select count(*) into v_target_sessions   from public.game_sessions     where game_id = v_target_id;
    select count(*) into v_target_user_games from public.user_games        where game_id = v_target_id;
    select count(*) into v_target_library    from public.user_game_library where game_id = v_target_id;

    if v_target_sessions = 0 and v_target_user_games = 0 and v_target_library = 0 then
      v_actual_mode := 'clean_retarget_empty_target';
    else
      v_actual_mode := 'merge_required';
    end if;
  end if;

  if v_actual_mode <> p_expected_mode then
    return jsonb_build_object(
      'error',    'mode_mismatch',
      'expected', p_expected_mode,
      'actual',   v_actual_mode
    );
  end if;

  if v_actual_mode = 'merge_required' then
    return jsonb_build_object('error', 'merge_required');
  end if;

  if v_actual_mode = 'clean_retarget_empty_target' then
    delete from public.games where id = v_target_id;
    v_deleted_target_id := v_target_id;
  end if;

  -- Apply metadata to source. Same shape for all three (allowed) modes.
  -- discord_application_id and ignored intentionally not touched: source's
  -- Discord telemetry is authoritative; ignored is an admin-curated flag.
  --
  -- Enrichment columns clear only when identity actually changes (i.e., not
  -- in refresh mode). Otherwise re-running a refresh would wipe curation.
  update public.games
  set
    igdb_id              = p_target_igdb_id,
    name                 = coalesce(p_metadata->>'name', name),
    slug                 = coalesce(p_metadata->>'slug', slug),
    cover_url            = p_metadata->>'cover_url',
    genres               = coalesce(
                             array(select jsonb_array_elements_text(p_metadata->'genres')),
                             genres
                           ),
    developer            = p_metadata->>'developer',
    publisher            = p_metadata->>'publisher',
    release_year         = nullif(p_metadata->>'release_year', '')::integer,
    description          = p_metadata->>'description',
    first_release_date   = nullif(p_metadata->>'first_release_date', '')::timestamptz,
    screenshots          = coalesce(
                             array(select jsonb_array_elements_text(p_metadata->'screenshots')),
                             screenshots
                           ),
    artwork_url          = p_metadata->>'artwork_url',
    rating               = nullif(p_metadata->>'rating', '')::numeric,
    rating_count         = nullif(p_metadata->>'rating_count', '')::integer,
    platforms            = coalesce(
                             array(select jsonb_array_elements_text(p_metadata->'platforms')),
                             platforms
                           ),
    igdb_url             = case
                             when p_metadata->>'slug' is not null then
                               'https://www.igdb.com/games/' || (p_metadata->>'slug')
                             else igdb_url
                           end,
    metadata_source      = 'igdb',
    igdb_updated_at      = now(),
    admin_remapped_at    = now(),
    admin_remapped_by    = p_actor_id,
    steamgriddb_game_id  = case when v_actual_mode = 'refresh' then steamgriddb_game_id  else null  end,
    steamgriddb_icon_url = case when v_actual_mode = 'refresh' then steamgriddb_icon_url else null  end,
    steamgriddb_logo_url = case when v_actual_mode = 'refresh' then steamgriddb_logo_url else null  end,
    steamgriddb_hero_url = case when v_actual_mode = 'refresh' then steamgriddb_hero_url else null  end,
    steamgriddb_grid_url = case when v_actual_mode = 'refresh' then steamgriddb_grid_url else null  end,
    assets_enriched      = case when v_actual_mode = 'refresh' then assets_enriched      else false end,
    curated_at           = case when v_actual_mode = 'refresh' then curated_at           else null  end,
    curated_by           = case when v_actual_mode = 'refresh' then curated_by           else null  end
  where id = p_source_id;

  return jsonb_build_object(
    'success',           true,
    'mode',              v_actual_mode,
    'source_id',         p_source_id,
    'deleted_target_id', v_deleted_target_id
  );
end;
$$;

comment on function public.admin_remap_apply is
  'Atomically apply an admin Game Remap. Locks source FOR UPDATE, re-derives mode '
  '(TOCTOU defense vs the corresponding admin_remap_plan call), refuses if the mode '
  'does not match the caller''s expectation or if mode is merge_required (admin_merge_games''s job). '
  'Sets admin_remapped_at and admin_remapped_by for provenance. Clears all SteamGridDB '
  'enrichment columns when identity changes (not in refresh mode); ImageKit folder '
  'cleanup is the caller''s responsibility (best-effort, app-layer).';

-- ---------------------------------------------------------------------------
-- admin_merge_games — always clears source's enrichment (identity always
-- changes; target row is deleted so its enrichment goes with it).
-- ---------------------------------------------------------------------------

create or replace function public.admin_merge_games(
  p_source_id uuid,
  p_target_id uuid,
  p_metadata  jsonb,
  p_actor_id  uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_source_ignored  boolean;
  v_target_ignored  boolean;
  v_target_igdb_id  integer;
  v_block_reasons   text[] := array[]::text[];
begin
  select ignored into v_source_ignored
    from public.games where id = p_source_id for update;
  if not found then
    return jsonb_build_object('error', 'source_not_found');
  end if;

  select ignored, igdb_id into v_target_ignored, v_target_igdb_id
    from public.games where id = p_target_id for update;
  if not found then
    return jsonb_build_object('error', 'target_not_found');
  end if;

  if p_source_id = p_target_id then
    return jsonb_build_object('error', 'same_row');
  end if;

  if v_source_ignored then
    v_block_reasons := array_append(v_block_reasons, 'source_ignored');
  end if;
  if v_target_ignored then
    v_block_reasons := array_append(v_block_reasons, 'target_ignored');
  end if;
  if array_length(v_block_reasons, 1) > 0 then
    return jsonb_build_object(
      'error',         'merge_blocked',
      'block_reasons', to_jsonb(v_block_reasons)
    );
  end if;

  -- 1. Reassign game_sessions.
  update public.game_sessions
    set game_id = p_source_id
    where game_id = p_target_id;

  -- 2. user_games — UNIQUE(user_id, game_id). Aggregate stats for users on
  --    both sides; reassign solo target-side rows.
  insert into public.user_games as canonical
    (user_id, game_id, total_time_secs, total_sessions, avg_session_secs, first_played, last_played)
  select
    tgt.user_id,
    p_source_id,
    tgt.total_time_secs,
    tgt.total_sessions,
    tgt.avg_session_secs,
    tgt.first_played,
    tgt.last_played
  from public.user_games tgt
  where tgt.game_id = p_target_id
  on conflict (user_id, game_id) do update set
    total_time_secs  = canonical.total_time_secs + excluded.total_time_secs,
    total_sessions   = canonical.total_sessions + excluded.total_sessions,
    avg_session_secs = case
      when canonical.total_sessions + excluded.total_sessions > 0
      then (canonical.total_time_secs + excluded.total_time_secs)
           / (canonical.total_sessions + excluded.total_sessions)
      else 0
    end,
    first_played = least(canonical.first_played, excluded.first_played),
    last_played  = greatest(canonical.last_played, excluded.last_played);

  delete from public.user_games where game_id = p_target_id;

  -- 3. user_game_library — target-side wins on conflict.
  delete from public.user_game_library as src
    using public.user_game_library as tgt
    where src.game_id = p_source_id
      and tgt.game_id = p_target_id
      and tgt.user_id = src.user_id;
  update public.user_game_library
    set game_id = p_source_id
    where game_id = p_target_id;

  -- 4. Delete target row before source UPDATE to avoid (igdb_id, slug) unique
  --    constraint collision when source takes target's identity.
  delete from public.games where id = p_target_id;

  -- 5. Copy target's IGDB identity + metadata onto source. Identity always
  --    changes here (target had a different igdb_id than source by definition
  --    of this RPC), so we always clear SteamGridDB enrichment on source.
  update public.games
  set
    igdb_id              = v_target_igdb_id,
    name                 = coalesce(p_metadata->>'name', name),
    slug                 = coalesce(p_metadata->>'slug', slug),
    cover_url            = p_metadata->>'cover_url',
    genres               = coalesce(
                             array(select jsonb_array_elements_text(p_metadata->'genres')),
                             genres
                           ),
    developer            = p_metadata->>'developer',
    publisher            = p_metadata->>'publisher',
    release_year         = nullif(p_metadata->>'release_year', '')::integer,
    description          = p_metadata->>'description',
    first_release_date   = nullif(p_metadata->>'first_release_date', '')::timestamptz,
    screenshots          = coalesce(
                             array(select jsonb_array_elements_text(p_metadata->'screenshots')),
                             screenshots
                           ),
    artwork_url          = p_metadata->>'artwork_url',
    rating               = nullif(p_metadata->>'rating', '')::numeric,
    rating_count         = nullif(p_metadata->>'rating_count', '')::integer,
    platforms            = coalesce(
                             array(select jsonb_array_elements_text(p_metadata->'platforms')),
                             platforms
                           ),
    igdb_url             = case
                             when p_metadata->>'slug' is not null then
                               'https://www.igdb.com/games/' || (p_metadata->>'slug')
                             else igdb_url
                           end,
    metadata_source      = 'igdb',
    igdb_updated_at      = now(),
    admin_remapped_at    = now(),
    admin_remapped_by    = p_actor_id,
    steamgriddb_game_id  = null,
    steamgriddb_icon_url = null,
    steamgriddb_logo_url = null,
    steamgriddb_hero_url = null,
    steamgriddb_grid_url = null,
    assets_enriched      = false,
    curated_at           = null,
    curated_by           = null
  where id = p_source_id;

  return jsonb_build_object(
    'success',           true,
    'mode',              'merge_required',
    'source_id',         p_source_id,
    'deleted_target_id', p_target_id
  );
end;
$$;

comment on function public.admin_merge_games is
  'Atomically merge two `games` rows representing the same logical game. Source''s id survives, target''s IGDB identity is copied onto source, target deleted. Reassigns game_sessions, aggregates user_games stats, drops source-side conflicting library entries and reassigns target-side ones. Refuses merge if either side has ignored=true. Always clears source''s SteamGridDB enrichment columns since identity changes; ImageKit folder cleanup is the caller''s responsibility (best-effort, app-layer).';
