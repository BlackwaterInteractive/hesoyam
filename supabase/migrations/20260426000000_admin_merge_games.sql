-- Admin Game Remap (issue #154 PR 2) — Mode 3 (merge retarget).
--
-- Adds the admin_merge_games RPC: collapses two `games` rows representing the
-- same logical game into one. Source's id survives (FK churn optimization —
-- source typically has more attached data), target's IGDB metadata + igdb_id
-- are copied onto source, target row is deleted. All FK reassignment happens
-- inside one transaction; either the whole merge succeeds or nothing changes.
--
-- Also updates admin_remap_plan to include `merge_details` for mode 3, so the
-- preview UI can show per-user aggregation, library merge previews, and
-- block reasons (e.g. ignored flag set).
--
-- Policy decisions baked in:
--
--   * Source's id and discord_application_id always preserved. Target's
--     igdb_id and IGDB metadata become source's identity.
--   * `ignored = true` on either side blocks the merge — admin must un-ignore
--     first via the existing edit flow. Reasoning: deciding which side's
--     ignored bit wins requires admin attention, so we surface it instead of
--     auto-resolving.
--   * `user_games`: per-user stats aggregate (sums for time + sessions, min
--     for first_played, max for last_played, recompute avg_session_secs).
--   * `user_game_library`: when same user has entries on both sides, the
--     target-side entry survives (mapped onto source's id), source-side is
--     dropped. The target row represents the correct game identity, so its
--     curated entry is the one to keep. (Mirrors reconcile_orphan_game's
--     `keep canonical` policy.)
--   * Live sessions: FKs reassign without interruption; no realtime topic
--     re-key. Clients listening to target's old game_id miss updates until
--     the next heartbeat or page reload. Pragmatic tradeoff — admin merges
--     are rare and the stale window is short.

-- ---------------------------------------------------------------------------
-- admin_remap_plan — refresh with merge_details for mode 3
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
  v_source_ignored     boolean;
  v_target_ignored     boolean;
  v_source_sessions    integer;
  v_source_user_games  integer;
  v_source_library     integer;
  v_target_sessions    integer;
  v_target_user_games  integer;
  v_target_library     integer;
  v_mode               text;
  v_merge_details      jsonb := null;
  v_block_reasons      text[] := array[]::text[];
  v_user_games_overlap jsonb;
  v_library_overlap    jsonb;
  v_live_sessions      integer;
  v_curated_drop_count integer;
  v_warnings           jsonb;
begin
  select row_to_json(g)::jsonb, g.ignored
    into v_source_jsonb, v_source_ignored
    from public.games g
    where g.id = p_source_id;

  if v_source_jsonb is null then
    return jsonb_build_object('error', 'source_not_found');
  end if;

  -- FK counts on source (informational; never change in modes 1/2; aggregate in mode 3).
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

    select row_to_json(g)::jsonb, g.ignored
      into v_target_jsonb, v_target_ignored
      from public.games g
      where g.id = v_target_id;
  end if;

  -- Build merge_details for mode 3 only.
  if v_mode = 'merge_required' then
    -- Block reasons.
    if v_source_ignored then
      v_block_reasons := array_append(v_block_reasons, 'source_ignored');
    end if;
    if v_target_ignored then
      v_block_reasons := array_append(v_block_reasons, 'target_ignored');
    end if;

    -- Per-user user_games overlap with merged preview.
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',                user_id,
      'source_total_time_secs', src_time,
      'source_total_sessions',  src_sessions,
      'source_first_played',    src_first,
      'source_last_played',     src_last,
      'target_total_time_secs', tgt_time,
      'target_total_sessions',  tgt_sessions,
      'target_first_played',    tgt_first,
      'target_last_played',     tgt_last,
      'merged_total_time_secs', src_time + tgt_time,
      'merged_total_sessions',  src_sessions + tgt_sessions
    )), '[]'::jsonb)
    into v_user_games_overlap
    from (
      select
        s.user_id,
        s.total_time_secs   as src_time,
        s.total_sessions    as src_sessions,
        s.first_played      as src_first,
        s.last_played       as src_last,
        t.total_time_secs   as tgt_time,
        t.total_sessions    as tgt_sessions,
        t.first_played      as tgt_first,
        t.last_played       as tgt_last
      from public.user_games s
      inner join public.user_games t on s.user_id = t.user_id
      where s.game_id = p_source_id
        and t.game_id = v_target_id
    ) ovr;

    -- Per-user library overlap with which side wins.
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',                 user_id,
      'source_status',           src_status,
      'source_personal_rating',  src_rating,
      'source_added_at',         src_added,
      'target_status',           tgt_status,
      'target_personal_rating',  tgt_rating,
      'target_added_at',         tgt_added,
      'survives',                'target',
      'curated',                 (src_status <> 'played' or src_rating is not null)
    )), '[]'::jsonb)
    into v_library_overlap
    from (
      select
        s.user_id,
        s.status           as src_status,
        s.personal_rating  as src_rating,
        s.added_at         as src_added,
        t.status           as tgt_status,
        t.personal_rating  as tgt_rating,
        t.added_at         as tgt_added
      from public.user_game_library s
      inner join public.user_game_library t on s.user_id = t.user_id
      where s.game_id = p_source_id
        and t.game_id = v_target_id
    ) ovr;

    -- Live sessions in flight on either row (informational only — merge proceeds).
    select count(*) into v_live_sessions
      from public.game_sessions
      where ended_at is null
        and game_id in (p_source_id, v_target_id);

    -- Curated library drop warning: source-side entries with non-default
    -- status or non-NULL personal_rating that will be dropped.
    select count(*) into v_curated_drop_count
      from public.user_game_library s
      inner join public.user_game_library t on s.user_id = t.user_id
      where s.game_id = p_source_id
        and t.game_id = v_target_id
        and (s.status <> 'played' or s.personal_rating is not null);

    v_warnings := '[]'::jsonb;
    if v_curated_drop_count > 0 then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'type',       'curated_library_drop',
        'user_count', v_curated_drop_count
      ));
    end if;

    v_merge_details := jsonb_build_object(
      'block_reasons',       to_jsonb(v_block_reasons),
      'user_games_overlap',  v_user_games_overlap,
      'library_overlap',     v_library_overlap,
      'live_sessions_count', v_live_sessions,
      'warnings',            v_warnings
    );
  end if;

  return jsonb_build_object(
    'mode',          v_mode,
    'source',        v_source_jsonb,
    'target_id',     v_target_id,
    'target',        v_target_jsonb,
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
    ),
    'merge_details', v_merge_details
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_merge_games — atomic Mode 3 merge
-- ---------------------------------------------------------------------------
-- Caller responsibilities:
--   * pre-check via admin_remap_plan that mode == 'merge_required' and
--     merge_details.block_reasons is empty.
--   * pass the IGDB metadata fetched for target's igdb_id (same shape as
--     used by admin_remap_apply).
--
-- The function locks both rows FOR UPDATE and re-checks block conditions
-- atomically before mutating, so a concurrent flip of the ignored flag
-- between plan and apply is caught.

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
  -- Lock both rows for the transaction. Source first (smaller-id ordering
  -- isn't strictly necessary — only admins use this UI, no parallel writers
  -- exist — but keeps lock acquisition deterministic if that ever changes).
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

  -- Re-check block conditions under the lock.
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

  -- 1. Reassign game_sessions. No unique constraint on game_id; straight UPDATE.
  --    Active sessions get re-pointed silently; the next heartbeat / session-end
  --    trigger operates against source. Listeners on the old target's game_id
  --    miss the next broadcast until they reconnect — documented tradeoff.
  update public.game_sessions
    set game_id = p_source_id
    where game_id = p_target_id;

  -- 2. user_games — UNIQUE(user_id, game_id). Aggregate stats for users on
  --    both sides; reassign solo target-side rows. Mirrors reconcile_orphan_game.
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

  -- 3. user_game_library — UNIQUE(user_id, game_id). Policy: target-side
  --    entry survives, source-side dropped on conflict.
  --
  --    a. Drop source-side entries that conflict with target-side ones.
  delete from public.user_game_library as src
    using public.user_game_library as tgt
    where src.game_id = p_source_id
      and tgt.game_id = p_target_id
      and tgt.user_id = src.user_id;
  --    b. Reassign remaining target-side entries to source's id (no conflict
  --       now that conflicts have been deleted).
  update public.user_game_library
    set game_id = p_source_id
    where game_id = p_target_id;

  -- 4. Copy target's IGDB identity + metadata onto source. Same shape as
  --    admin_remap_apply's UPDATE. discord_application_id and ignored on
  --    source are intentionally not touched — source's Discord telemetry is
  --    authoritative; ignored we already verified is false on both sides.
  update public.games
  set
    igdb_id            = v_target_igdb_id,
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

  -- 5. Delete the target row. By this point all FK dependents have been
  --    repointed; if anything slips through, the DELETE raises
  --    foreign_key_violation and the whole txn rolls back.
  delete from public.games where id = p_target_id;

  return jsonb_build_object(
    'success',           true,
    'mode',              'merge_required',
    'source_id',         p_source_id,
    'deleted_target_id', p_target_id
  );
end;
$$;

comment on function public.admin_merge_games is
  'Atomically merge two `games` rows representing the same logical game. Source''s id survives, target''s IGDB identity is copied onto source, target deleted. Reassigns game_sessions, aggregates user_games stats, drops source-side conflicting library entries and reassigns target-side ones. Refuses merge if either side has ignored=true. See issue #154 PR 2.';
