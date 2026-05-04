-- Admin Consolidate Games (issue #194 PR 2).
--
-- Folds an "orphan" `games` row (e.g. the Delta Force companion bot's
-- auto-created row) into the "canonical" row representing the same real
-- game. Differs from admin_merge_games (issue #154 PR 2) in policy:
--
--   admin_merge_games — for fixing a wrong IGDB identity. Source survives
--     with target's IGDB metadata; designed around picking a corrected
--     IGDB id.
--   admin_consolidate_games — for federation cleanup. Canonical's identity
--     is preserved entirely (it's already correct). Orphan's data is folded
--     in (overlapping sessions deleted as duplicates; distinct ones
--     repointed; junction rows moved; orphan deleted).
--
-- Why deleting overlapping sessions is correct: in the federation flap
-- pattern, the orphan was created because Discord broadcast a sibling
-- application id (companion bot, launcher) that the resolver couldn't
-- federate automatically. The orphan and canonical sessions were
-- recorded for the same physical play time. Keeping both = double-counting
-- (concept: Phantom Time / Interval Reopening — concepts.md). Deleting
-- the orphan side leaves canonical's correct record intact.
--
-- Why orphan user_games stats are deleted (not aggregated): they reflect
-- the orphan's sessions, which are now either gone (overlapping → deleted)
-- or repointed onto canonical (which has its own stats based on its own
-- sessions). Aggregating would re-count the deleted overlaps.

-- ---------------------------------------------------------------------------
-- admin_consolidate_games_plan — read-only preview for the admin UI.
-- ---------------------------------------------------------------------------
-- Returns counts the operator sees before confirming:
--   * sessions_overlapping  — orphan sessions that overlap a canonical
--                             session for the same user (will be deleted)
--   * sessions_distinct     — orphan sessions with no canonical overlap
--                             (will be repointed to canonical)
--   * library_overlapping   — orphan user_game_library entries where
--                             canonical already has one for that user
--                             (will be deleted)
--   * library_distinct      — orphan library entries with no canonical
--                             counterpart (will be repointed)
--   * application_ids       — Discord app IDs currently mapped to the
--                             orphan (will be repointed to canonical)
--   * block_reasons         — reasons consolidate would refuse to proceed
--                             (e.g. same row, ignored flag set)

create or replace function public.admin_consolidate_games_plan(
  p_orphan_id    uuid,
  p_canonical_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_orphan_jsonb         jsonb;
  v_canonical_jsonb      jsonb;
  v_orphan_ignored       boolean;
  v_canonical_ignored    boolean;
  v_sessions_overlapping integer;
  v_sessions_distinct    integer;
  v_library_overlapping  integer;
  v_library_distinct     integer;
  v_application_ids      text[];
  v_block_reasons        text[] := array[]::text[];
begin
  if p_orphan_id = p_canonical_id then
    return jsonb_build_object('error', 'same_row');
  end if;

  select row_to_json(g)::jsonb, g.ignored
    into v_orphan_jsonb, v_orphan_ignored
    from public.games g where g.id = p_orphan_id;
  if v_orphan_jsonb is null then
    return jsonb_build_object('error', 'orphan_not_found');
  end if;

  select row_to_json(g)::jsonb, g.ignored
    into v_canonical_jsonb, v_canonical_ignored
    from public.games g where g.id = p_canonical_id;
  if v_canonical_jsonb is null then
    return jsonb_build_object('error', 'canonical_not_found');
  end if;

  -- Block reasons: ignored flag on either side. Same policy as
  -- admin_merge_games — surface for admin attention rather than auto-resolve.
  if v_orphan_ignored then
    v_block_reasons := array_append(v_block_reasons, 'orphan_ignored');
  end if;
  if v_canonical_ignored then
    v_block_reasons := array_append(v_block_reasons, 'canonical_ignored');
  end if;

  -- Sessions: overlapping vs distinct.
  -- Overlap = same user_id AND time-range intersects a canonical session
  -- (using tstzrange with COALESCE(ended_at, now()) to handle still-open
  -- sessions consistently).
  with classified as (
    select
      o.id,
      exists (
        select 1 from public.game_sessions c
        where c.game_id = p_canonical_id
          and c.user_id = o.user_id
          and tstzrange(c.started_at, coalesce(c.ended_at, now())) &&
              tstzrange(o.started_at, coalesce(o.ended_at, now()))
      ) as overlaps_canonical
    from public.game_sessions o
    where o.game_id = p_orphan_id
  )
  select
    count(*) filter (where overlaps_canonical),
    count(*) filter (where not overlaps_canonical)
    into v_sessions_overlapping, v_sessions_distinct
    from classified;

  -- user_game_library: same-user overlap = orphan entry with a canonical
  -- entry for the same user (will be deleted, canonical's curated entry wins).
  with classified as (
    select
      o.id,
      exists (
        select 1 from public.user_game_library c
        where c.game_id = p_canonical_id
          and c.user_id = o.user_id
      ) as overlaps_canonical
    from public.user_game_library o
    where o.game_id = p_orphan_id
  )
  select
    count(*) filter (where overlaps_canonical),
    count(*) filter (where not overlaps_canonical)
    into v_library_overlapping, v_library_distinct
    from classified;

  -- Discord application ids currently on the orphan.
  select coalesce(array_agg(application_id order by application_id), array[]::text[])
    into v_application_ids
    from public.game_discord_applications
    where game_id = p_orphan_id;

  return jsonb_build_object(
    'orphan',                v_orphan_jsonb,
    'canonical',             v_canonical_jsonb,
    'sessions_overlapping',  v_sessions_overlapping,
    'sessions_distinct',     v_sessions_distinct,
    'library_overlapping',   v_library_overlapping,
    'library_distinct',      v_library_distinct,
    'application_ids',       to_jsonb(v_application_ids),
    'block_reasons',         to_jsonb(v_block_reasons)
  );
end;
$$;

comment on function public.admin_consolidate_games_plan is
  'Read-only preview of an admin consolidation. Returns counts of sessions and library entries that will be deleted vs repointed, the Discord app ids to be moved, and block reasons. Issue #194 PR 2.';

-- ---------------------------------------------------------------------------
-- admin_consolidate_games — atomic apply.
-- ---------------------------------------------------------------------------
-- Caller responsibilities:
--   * Pre-check via admin_consolidate_games_plan that block_reasons is empty.
--   * After success, invalidate resolver LRU cache for every entry in
--     the returned `moved_application_ids` (otherwise the backend's
--     in-memory cache will hand out the deleted orphan game id for up to
--     1h until TTL — concept: cache invalidation on Consolidate, see
--     current-working-plan/feat-game-app-id-federation/plan.md).
--
-- The function locks both rows FOR UPDATE and re-checks block conditions
-- under the lock so a concurrent flip of the ignored flag between plan
-- and apply is caught.

create or replace function public.admin_consolidate_games(
  p_orphan_id    uuid,
  p_canonical_id uuid,
  p_actor_id     uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_orphan_ignored      boolean;
  v_orphan_name         text;
  v_canonical_ignored   boolean;
  v_block_reasons       text[] := array[]::text[];
  v_sessions_deleted    integer;
  v_sessions_repointed  integer;
  v_library_deleted     integer;
  v_library_repointed   integer;
  v_moved_app_ids       text[];
begin
  if p_orphan_id = p_canonical_id then
    return jsonb_build_object('error', 'same_row');
  end if;

  -- Lock both rows for the transaction. Order is fixed (orphan first, then
  -- canonical) so concurrent admins can't deadlock by holding the locks in
  -- opposite orders.
  select ignored, name into v_orphan_ignored, v_orphan_name
    from public.games where id = p_orphan_id for update;
  if not found then
    return jsonb_build_object('error', 'orphan_not_found');
  end if;

  select ignored into v_canonical_ignored
    from public.games where id = p_canonical_id for update;
  if not found then
    return jsonb_build_object('error', 'canonical_not_found');
  end if;

  if v_orphan_ignored then
    v_block_reasons := array_append(v_block_reasons, 'orphan_ignored');
  end if;
  if v_canonical_ignored then
    v_block_reasons := array_append(v_block_reasons, 'canonical_ignored');
  end if;
  if array_length(v_block_reasons, 1) > 0 then
    return jsonb_build_object(
      'error',         'consolidate_blocked',
      'block_reasons', to_jsonb(v_block_reasons)
    );
  end if;

  -- 1. Delete orphan sessions that overlap a canonical session for the same
  --    user — they're double-counts of the same physical play. Concept:
  --    Phantom Time / Interval Reopening (concepts.md).
  with deleted as (
    delete from public.game_sessions o
      where o.game_id = p_orphan_id
        and exists (
          select 1 from public.game_sessions c
          where c.game_id = p_canonical_id
            and c.user_id = o.user_id
            and tstzrange(c.started_at, coalesce(c.ended_at, now())) &&
                tstzrange(o.started_at, coalesce(o.ended_at, now()))
        )
      returning id
  )
  select count(*) into v_sessions_deleted from deleted;

  -- 2. Repoint remaining (non-overlapping) orphan sessions to canonical.
  with repointed as (
    update public.game_sessions
      set game_id = p_canonical_id
      where game_id = p_orphan_id
      returning id
  )
  select count(*) into v_sessions_repointed from repointed;

  -- 3. Drop orphan library entries where canonical has one for the same user.
  --    Canonical's curated entry wins (mirrors admin_merge_games policy).
  with deleted as (
    delete from public.user_game_library o
      using public.user_game_library c
      where o.game_id = p_orphan_id
        and c.game_id = p_canonical_id
        and c.user_id = o.user_id
      returning o.id
  )
  select count(*) into v_library_deleted from deleted;

  -- 4. Repoint remaining orphan library entries.
  with repointed as (
    update public.user_game_library
      set game_id = p_canonical_id
      where game_id = p_orphan_id
      returning id
  )
  select count(*) into v_library_repointed from repointed;

  -- 5. Drop orphan user_games stats. Their sessions are gone or repointed;
  --    canonical's stats are based on canonical's own sessions and stay
  --    correct. Aggregating orphan stats would double-count the duplicates
  --    we just deleted in step 1.
  delete from public.user_games where game_id = p_orphan_id;

  -- 6. Move junction rows (Discord application id mappings) onto canonical.
  --    Returns the moved ids so the caller can invalidate resolver cache.
  with moved as (
    update public.game_discord_applications
      set game_id = p_canonical_id
      where game_id = p_orphan_id
      returning application_id
  )
  select coalesce(array_agg(application_id), array[]::text[])
    into v_moved_app_ids from moved;

  -- 7. Audit log entry. Snapshot orphan name + moved app ids — orphan row
  --    is about to be deleted, so this is our only persistent record.
  insert into public.game_consolidation_log (
    canonical_game_id,
    orphan_game_id,
    orphan_name,
    moved_application_ids,
    sessions_deleted,
    sessions_repointed,
    library_deleted,
    library_repointed,
    actor_id
  ) values (
    p_canonical_id,
    p_orphan_id,
    v_orphan_name,
    v_moved_app_ids,
    v_sessions_deleted,
    v_sessions_repointed,
    v_library_deleted,
    v_library_repointed,
    p_actor_id
  );

  -- 8. Delete the orphan row. Steps 1–6 cleared every FK that pointed at it.
  delete from public.games where id = p_orphan_id;

  return jsonb_build_object(
    'success',                true,
    'orphan_id',              p_orphan_id,
    'canonical_id',           p_canonical_id,
    'sessions_deleted',       v_sessions_deleted,
    'sessions_repointed',     v_sessions_repointed,
    'library_deleted',        v_library_deleted,
    'library_repointed',      v_library_repointed,
    'moved_application_ids',  to_jsonb(v_moved_app_ids)
  );
end;
$$;

comment on function public.admin_consolidate_games is
  'Atomically fold an orphan `games` row into a canonical row. Deletes orphan sessions overlapping with canonical (double-counts of the same physical play) and repoints the rest; folds user_game_library similarly; moves Discord app id junction rows; deletes orphan user_games stats and the orphan game row. Caller MUST invalidate the resolver cache for the returned `moved_application_ids`. Issue #194 PR 2.';

-- ---------------------------------------------------------------------------
-- admin_consolidation_candidates — auto-suggest pairs the admin should review.
-- ---------------------------------------------------------------------------
-- Two heuristics:
--
--   1. Time-overlap heuristic: pairs of `games` rows where the SAME user has
--      overlapping sessions on both rows. The strongest signal — proves
--      Discord broadcast both rows during the same play, so they almost
--      certainly represent the same canonical game.
--
--   2. Orphan-shape heuristic: rows likely to be unfederated bot/launcher
--      orphans — `metadata_source = 'discord'`, `igdb_id IS NULL`,
--      `admin_remapped_at IS NULL` (admin hasn't touched them), with at
--      least one session. These don't have a paired canonical to suggest,
--      so they're returned as singletons for the admin to manually pair.
--
-- Returns one row per candidate. For pair candidates, both `orphan_id`
-- and `canonical_id` are set. For singleton orphans, `canonical_id` is null
-- and the admin picks the canonical manually in the UI.

create or replace function public.admin_consolidation_candidates()
returns table (
  orphan_id        uuid,
  orphan_name      text,
  canonical_id     uuid,
  canonical_name   text,
  reason           text,
  signal_strength  integer
)
language sql
security definer
set search_path to ''
as $$
  -- Heuristic 1: time-overlap pairs. Higher signal_strength = stronger evidence.
  with overlap_pairs as (
    select
      least(a.game_id, b.game_id)    as game_a,
      greatest(a.game_id, b.game_id) as game_b,
      count(*) as overlap_count,
      count(distinct a.user_id) as users_affected
    from public.game_sessions a
    join public.game_sessions b
      on a.user_id = b.user_id
     and a.game_id < b.game_id
     and tstzrange(a.started_at, coalesce(a.ended_at, now())) &&
         tstzrange(b.started_at, coalesce(b.ended_at, now()))
    group by 1, 2
  ),
  pair_candidates as (
    select
      -- Pick the row with NULL igdb_id as orphan; if both null or both set,
      -- pick the one with `metadata_source = 'discord'` (auto-created).
      case
        when ga.igdb_id is null and gb.igdb_id is not null then op.game_a
        when gb.igdb_id is null and ga.igdb_id is not null then op.game_b
        when ga.metadata_source = 'discord' and gb.metadata_source <> 'discord' then op.game_a
        when gb.metadata_source = 'discord' and ga.metadata_source <> 'discord' then op.game_b
        else op.game_a  -- ambiguous; admin can swap in the UI
      end as orphan_id,
      case
        when ga.igdb_id is null and gb.igdb_id is not null then op.game_b
        when gb.igdb_id is null and ga.igdb_id is not null then op.game_a
        when ga.metadata_source = 'discord' and gb.metadata_source <> 'discord' then op.game_b
        when gb.metadata_source = 'discord' and ga.metadata_source <> 'discord' then op.game_a
        else op.game_b
      end as canonical_id,
      op.users_affected,
      op.overlap_count
    from overlap_pairs op
    join public.games ga on ga.id = op.game_a
    join public.games gb on gb.id = op.game_b
    -- Skip pairs already explicitly admin-handled (remap or earlier consolidate).
    where (ga.admin_remapped_at is null or gb.admin_remapped_at is null)
      and not (ga.ignored or gb.ignored)
  )
  select
    pc.orphan_id,
    go.name as orphan_name,
    pc.canonical_id,
    gc.name as canonical_name,
    'time_overlap' as reason,
    -- 100 base for pair evidence + 10 per affected user (capped reasonable).
    100 + least(pc.users_affected * 10, 50) as signal_strength
  from pair_candidates pc
  join public.games go on go.id = pc.orphan_id
  join public.games gc on gc.id = pc.canonical_id

  union all

  -- Heuristic 2: singleton orphan-shape rows. Lower signal_strength.
  -- Excludes rows already implicated as orphans in heuristic 1 (UNION ALL
  -- with DISTINCT ON below could dedupe, but we want both rows surfaced
  -- separately so the admin can see overlap pairs prioritized).
  select
    g.id,
    g.name,
    null::uuid,
    null::text,
    'orphan_shape',
    50
  from public.games g
  where g.metadata_source = 'discord'
    and g.igdb_id is null
    and g.admin_remapped_at is null
    and not g.ignored
    and exists (
      select 1 from public.game_sessions s where s.game_id = g.id
    )
    -- Don't double-list rows already surfaced as a paired orphan.
    and not exists (
      select 1 from public.game_sessions a
      join public.game_sessions b
        on a.user_id = b.user_id
       and a.game_id <> b.game_id
       and tstzrange(a.started_at, coalesce(a.ended_at, now())) &&
           tstzrange(b.started_at, coalesce(b.ended_at, now()))
      where a.game_id = g.id
    )

  order by signal_strength desc, orphan_name;
$$;

comment on function public.admin_consolidation_candidates is
  'Surfaces candidate game pairs the admin should review for consolidation. Heuristic 1: pairs of games with overlapping sessions per same user (time_overlap). Heuristic 2: orphan-shape rows (metadata_source=discord + igdb_id null + no admin remap). Issue #194 PR 2.';

-- Revoke default execute. Admin path uses service-role (bypasses grants).
revoke execute on function public.admin_consolidate_games_plan from public, anon, authenticated;
revoke execute on function public.admin_consolidate_games from public, anon, authenticated;
revoke execute on function public.admin_consolidation_candidates from public, anon, authenticated;
