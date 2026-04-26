-- Admin Game Delete RPCs.
--
-- Mirrors the Plan/Apply pattern used by admin_remap_plan / admin_remap_apply
-- (#154). Supports the admin dashboard's destructive "Delete Game" UX:
--
--   admin_delete_game_plan(p_game_id) → jsonb
--     Read-only inspection. Returns the games row, FK counts, per-user
--     breakdown of impact (sessions / user_games / library), live-session
--     count, and any blocking reasons. Idempotent.
--
--   admin_delete_game(p_game_id, p_actor_id) → jsonb
--     Atomic mutation. Locks source FOR UPDATE, re-checks block conditions
--     under the lock (TOCTOU defense vs the corresponding plan call), and
--     deletes in FK-safe order (game_sessions → user_games →
--     user_game_library → games). Refuses if any live session is in flight
--     on the row.
--
-- Block reasons:
--   live_sessions  — at least one game_sessions row with ended_at IS NULL
--                    points at this game. Admin must let live sessions end
--                    (or end them manually) before delete proceeds.
--
-- Out of scope (tracked in #163):
--   - Audit log of admin deletes (no admin_audit_log table yet)
--   - Cascade-delete to other tables (only the four tables above reference
--     games.id; if that ever changes, this function needs updating)

-- ---------------------------------------------------------------------------
-- admin_delete_game_plan — pure inspection
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_game_plan(
  p_game_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_game_jsonb         jsonb;
  v_sessions           integer;
  v_user_games         integer;
  v_library            integer;
  v_live_sessions      integer;
  v_users_affected     integer;
  v_per_user           jsonb;
  v_block_reasons      text[] := array[]::text[];
begin
  select row_to_json(g)::jsonb into v_game_jsonb
    from public.games g
    where g.id = p_game_id;

  if v_game_jsonb is null then
    return jsonb_build_object('error', 'game_not_found');
  end if;

  select count(*) into v_sessions   from public.game_sessions     where game_id = p_game_id;
  select count(*) into v_user_games from public.user_games        where game_id = p_game_id;
  select count(*) into v_library    from public.user_game_library where game_id = p_game_id;

  -- Live sessions block the delete (per #160 follow-up). Admin must let
  -- them end (or end them manually) first.
  select count(*) into v_live_sessions
    from public.game_sessions
    where game_id = p_game_id
      and ended_at is null;

  if v_live_sessions > 0 then
    v_block_reasons := array_append(v_block_reasons, 'live_sessions');
  end if;

  -- Distinct users impacted across all three FK tables. A "deletion" wipes
  -- their session history, play stats, and any library entry for this game.
  select count(distinct user_id) into v_users_affected from (
    select user_id from public.game_sessions     where game_id = p_game_id
    union
    select user_id from public.user_games        where game_id = p_game_id
    union
    select user_id from public.user_game_library where game_id = p_game_id
  ) u;

  -- Per-user breakdown so the admin can see WHO they're affecting before
  -- pulling the trigger. Includes session count + total time + library
  -- presence flag for each user.
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',           u.user_id,
    'sessions',          coalesce(u.session_count, 0),
    'total_time_secs',   coalesce(u.total_time_secs, 0),
    'has_user_games',    u.has_user_games,
    'has_library',       u.has_library
  ) order by coalesce(u.total_time_secs, 0) desc), '[]'::jsonb)
  into v_per_user
  from (
    select
      user_id,
      max(sc) as session_count,
      max(tt) as total_time_secs,
      bool_or(ug) as has_user_games,
      bool_or(lib) as has_library
    from (
      select user_id,
             count(*) as sc, null::bigint as tt, false as ug, false as lib
        from public.game_sessions
        where game_id = p_game_id
        group by user_id
      union all
      select user_id,
             null::bigint as sc, total_time_secs as tt, true as ug, false as lib
        from public.user_games
        where game_id = p_game_id
      union all
      select user_id,
             null::bigint as sc, null::bigint as tt, false as ug, true as lib
        from public.user_game_library
        where game_id = p_game_id
    ) src
    group by user_id
  ) u;

  return jsonb_build_object(
    'game',          v_game_jsonb,
    'fk_counts', jsonb_build_object(
      'sessions',      v_sessions,
      'user_games',    v_user_games,
      'library',       v_library,
      'live_sessions', v_live_sessions,
      'users_affected', v_users_affected
    ),
    'per_user',      v_per_user,
    'block_reasons', to_jsonb(v_block_reasons)
  );
end;
$$;

comment on function public.admin_delete_game_plan is
  'Read-only preview of an admin Game Delete operation. Returns the games '
  'row, FK counts (game_sessions / user_games / user_game_library / live), '
  'per-user breakdown of impact, and block_reasons (e.g. live_sessions) '
  'that prevent the corresponding admin_delete_game call from proceeding.';

-- ---------------------------------------------------------------------------
-- admin_delete_game — atomic mutation
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_game(
  p_game_id  uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_game_id_check        uuid;
  v_live_sessions        integer;
  v_block_reasons        text[] := array[]::text[];
  v_sessions_deleted     integer;
  v_user_games_deleted   integer;
  v_library_deleted      integer;
begin
  -- Lock the row for the transaction. Closes the TOCTOU window vs the
  -- corresponding admin_delete_game_plan call: anyone else trying to mutate
  -- the row (or another admin trying to delete it) waits.
  select id into v_game_id_check
    from public.games
    where id = p_game_id
    for update;

  if v_game_id_check is null then
    return jsonb_build_object('error', 'game_not_found');
  end if;

  -- Re-check block conditions under the lock.
  select count(*) into v_live_sessions
    from public.game_sessions
    where game_id = p_game_id
      and ended_at is null;

  if v_live_sessions > 0 then
    v_block_reasons := array_append(v_block_reasons, 'live_sessions');
  end if;

  if array_length(v_block_reasons, 1) > 0 then
    return jsonb_build_object(
      'error',         'delete_blocked',
      'block_reasons', to_jsonb(v_block_reasons)
    );
  end if;

  -- FK-safe deletion order. game_sessions, user_games, and user_game_library
  -- all reference games.id with default RESTRICT — must clear them first.
  delete from public.game_sessions where game_id = p_game_id;
  get diagnostics v_sessions_deleted = row_count;

  delete from public.user_games where game_id = p_game_id;
  get diagnostics v_user_games_deleted = row_count;

  delete from public.user_game_library where game_id = p_game_id;
  get diagnostics v_library_deleted = row_count;

  delete from public.games where id = p_game_id;
  -- We don't capture the games row count — at this point either it's 1 (the
  -- only sane case) or the FK constraint we missed throws and rolls back
  -- the whole transaction.

  return jsonb_build_object(
    'success',              true,
    'deleted_game_id',      p_game_id,
    'sessions_deleted',     v_sessions_deleted,
    'user_games_deleted',   v_user_games_deleted,
    'library_deleted',      v_library_deleted,
    'actor_id',             p_actor_id
  );
end;
$$;

comment on function public.admin_delete_game is
  'Atomically delete a games row plus all FK dependents (game_sessions, '
  'user_games, user_game_library). Locks the row FOR UPDATE, refuses if '
  'any live session is in flight, deletes in FK-safe order. Pair with '
  'admin_delete_game_plan() — same code path: plan inspects, apply mutates.';

-- Lock down EXECUTE from the start (matches the security profile of the
-- other admin_* RPCs after #157). Only service_role + postgres can call
-- these — admin server actions go through createAdminClient() which uses
-- the service_role key.
revoke execute on function
  public.admin_delete_game_plan(uuid),
  public.admin_delete_game(uuid, uuid)
from public, anon, authenticated;