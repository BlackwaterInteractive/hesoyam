-- Admin Game Remap (issue #154 PR 1) — modes 1 & 2 only.
--
-- Adds two functions used by apps/admin "Remap Game" dialog:
--
--   admin_remap_plan(source_id, target_igdb_id) → jsonb
--     Pure inspection. Returns the detected mode plus the data the preview
--     UI needs (current source row, target row if any, FK counts on both).
--     Idempotent. Read-only. Safe to call multiple times.
--
--   admin_remap_apply(source_id, target_igdb_id, metadata, expected_mode, actor_id) → jsonb
--     Atomic mutation. Re-checks mode under FOR UPDATE lock to defend
--     against TOCTOU between plan and apply. If actual mode != expected,
--     returns mode_mismatch and the caller re-fetches the plan.
--
-- Modes:
--   refresh                       — source's igdb_id already matches target → metadata refresh in place.
--   clean_retarget_no_target      — no row has the target igdb_id → update source in place.
--   clean_retarget_empty_target   — a target row exists but has zero FKs → delete target, update source.
--   merge_required                — target has FKs (sessions / user_games / library); PR 1 refuses,
--                                   PR 2 ships admin_merge_games.
--
-- Also adds two columns + a partial index for provenance:
--
--   games.admin_remapped_at  — last admin-remap timestamp (NULL = never)
--   games.admin_remapped_by  — admin auth.users.id who did it
--
-- Set inside admin_remap_apply on every successful run, including refreshes.

-- ---------------------------------------------------------------------------
-- Provenance columns
-- ---------------------------------------------------------------------------
alter table public.games
  add column if not exists admin_remapped_at timestamptz,
  add column if not exists admin_remapped_by uuid references auth.users(id) on delete set null;

create index if not exists idx_games_admin_remapped_at
  on public.games (admin_remapped_at)
  where admin_remapped_at is not null;

comment on column public.games.admin_remapped_at is
  'When an admin last manually corrected this row''s IGDB identity via the admin remap UI. NULL means the row''s identity has never been admin-verified.';
comment on column public.games.admin_remapped_by is
  'auth.users.id of the admin who last remapped this row. Set in tandem with admin_remapped_at.';

-- ---------------------------------------------------------------------------
-- admin_remap_plan — pure inspection
-- ---------------------------------------------------------------------------
create or replace function public.admin_remap_plan(
  p_source_id      uuid,
  p_target_igdb_id integer
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_source_jsonb       jsonb;
  v_target_jsonb       jsonb := null;
  v_target_id          uuid;
  v_source_sessions    integer;
  v_source_user_games  integer;
  v_source_library     integer;
  v_target_sessions    integer;
  v_target_user_games  integer;
  v_target_library     integer;
  v_mode               text;
begin
  select row_to_json(g)::jsonb into v_source_jsonb
    from public.games g
    where g.id = p_source_id;

  if v_source_jsonb is null then
    return jsonb_build_object('error', 'source_not_found');
  end if;

  -- FK counts on source (informational; never change in modes 1/2).
  select count(*) into v_source_sessions   from public.game_sessions     where game_id = p_source_id;
  select count(*) into v_source_user_games from public.user_games        where game_id = p_source_id;
  select count(*) into v_source_library    from public.user_game_library where game_id = p_source_id;

  select id into v_target_id
    from public.games
    where igdb_id = p_target_igdb_id;

  if v_target_id is null then
    v_mode := 'clean_retarget_no_target';
  elsif v_target_id = p_source_id then
    v_mode := 'refresh';
  else
    select count(*) into v_target_sessions   from public.game_sessions     where game_id = v_target_id;
    select count(*) into v_target_user_games from public.user_games        where game_id = v_target_id;
    select count(*) into v_target_library    from public.user_game_library where game_id = v_target_id;

    if v_target_sessions = 0 and v_target_user_games = 0 and v_target_library = 0 then
      v_mode := 'clean_retarget_empty_target';
    else
      v_mode := 'merge_required';
    end if;

    select row_to_json(g)::jsonb into v_target_jsonb
      from public.games g
      where g.id = v_target_id;
  end if;

  return jsonb_build_object(
    'mode',      v_mode,
    'source',    v_source_jsonb,
    'target_id', v_target_id,
    'target',    v_target_jsonb,
    'fk_counts', jsonb_build_object(
      'source', jsonb_build_object(
        'sessions',   v_source_sessions,
        'user_games', v_source_user_games,
        'library',    v_source_library
      ),
      'target', case
        when v_target_id is not null and v_target_id <> p_source_id then
          jsonb_build_object(
            'sessions',   coalesce(v_target_sessions, 0),
            'user_games', coalesce(v_target_user_games, 0),
            'library',    coalesce(v_target_library, 0)
          )
        else null
      end
    )
  );
end;
$$;

comment on function public.admin_remap_plan is
  'Read-only preview of an admin Game Remap operation. Returns detected mode '
  '(refresh / clean_retarget_no_target / clean_retarget_empty_target / merge_required) '
  'plus the current source row, target row if any, and FK counts on both. Pair with '
  'admin_remap_apply() — same code path: plan inspects, apply mutates under FOR UPDATE lock.';

-- ---------------------------------------------------------------------------
-- admin_remap_apply — atomic mutation
-- ---------------------------------------------------------------------------
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
    -- PR 1 doesn't ship merge logic. PR 2 will add admin_merge_games.
    return jsonb_build_object('error', 'merge_required');
  end if;

  -- For clean_retarget_empty_target, delete the target row first so we don't
  -- collide on the unique (igdb_id, slug) constraints when source's UPDATE
  -- below takes target's identity. Safe — we just verified target has zero FKs.
  if v_actual_mode = 'clean_retarget_empty_target' then
    delete from public.games where id = v_target_id;
    v_deleted_target_id := v_target_id;
  end if;

  -- Apply metadata to source. Same shape for all three (allowed) modes.
  -- discord_application_id and ignored intentionally not touched: source's
  -- Discord telemetry is authoritative; ignored is an admin-curated flag.
  update public.games
  set
    igdb_id            = p_target_igdb_id,
    name               = coalesce(p_metadata->>'name', name),
    slug               = coalesce(p_metadata->>'slug', slug),
    cover_url          = p_metadata->>'cover_url',
    genres             = coalesce(
                           array(select jsonb_array_elements_text(p_metadata->'genres')),
                           genres
                         ),
    developer          = p_metadata->>'developer',
    publisher          = p_metadata->>'publisher',
    release_year       = nullif(p_metadata->>'release_year', '')::integer,
    description        = p_metadata->>'description',
    first_release_date = nullif(p_metadata->>'first_release_date', '')::timestamptz,
    screenshots        = coalesce(
                           array(select jsonb_array_elements_text(p_metadata->'screenshots')),
                           screenshots
                         ),
    artwork_url        = p_metadata->>'artwork_url',
    rating             = nullif(p_metadata->>'rating', '')::numeric,
    rating_count       = nullif(p_metadata->>'rating_count', '')::integer,
    platforms          = coalesce(
                           array(select jsonb_array_elements_text(p_metadata->'platforms')),
                           platforms
                         ),
    igdb_url           = case
                           when p_metadata->>'slug' is not null then
                             'https://www.igdb.com/games/' || (p_metadata->>'slug')
                           else igdb_url
                         end,
    metadata_source    = 'igdb',
    igdb_updated_at    = now(),
    admin_remapped_at  = now(),
    admin_remapped_by  = p_actor_id
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
  'does not match the caller''s expectation or if mode is merge_required (PR 2 territory). '
  'Sets admin_remapped_at and admin_remapped_by for provenance.';
