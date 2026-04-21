-- Session duration threshold
--
-- Product rule: game sessions below a configurable minimum duration should not
-- count toward user-facing playtime totals, dashboard aggregates, calendar
-- heatmap, or play patterns. Library membership is NOT gated by duration —
-- any session (however short) still adds the game to the user's library via
-- the existing `trg_auto_add_to_library` trigger, which this migration does
-- not touch.
--
-- The threshold lives in `system_config` so it can be tuned without a code
-- deploy. Default: 300 seconds (5 minutes).
--
-- What this migration changes:
--   1. Inserts `min_session_duration_secs` into `system_config` (if absent).
--   2. Adds helper `public.get_min_session_duration_secs()` that reads config
--      with a safe fallback.
--   3. `update_user_game_stats` trigger — short sessions no longer accumulate
--      into `user_games` totals.
--   4. `get_dashboard_overview` — today/week/month aggregates filtered;
--      live_session stays unfiltered so in-progress sessions always render.
--   5. `get_calendar_data` — filtered.
--   6. `get_play_patterns` — filtered.
--
-- What this migration does NOT change:
--   - `auto_add_to_library` / `trg_auto_add_to_library`: library add stays
--     duration-agnostic by design.
--   - `handle_session_insert`: still creates the zero-stub in `user_games` on
--     session INSERT. Short-session games will appear with total_time_secs=0,
--     total_sessions=0 until a qualifying session arrives. This is intentional.
--   - Admin queries (apps/admin): raw-data views, unfiltered by design.
--   - Mobile direct Supabase queries: unchanged for now; they'll be moved
--     behind backend APIs in a later PR.

-- 1. Config row (idempotent)
insert into public.system_config (key, value)
values ('min_session_duration_secs', '300'::jsonb)
on conflict (key) do nothing;

-- 2. Helper: read threshold from system_config with 300 fallback.
-- STABLE so the planner may cache within a single statement.
create or replace function public.get_min_session_duration_secs()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (value)::text::int
       from public.system_config
      where key = 'min_session_duration_secs'),
    300
  );
$$;

-- 3. update_user_game_stats: same as before, but short sessions don't
-- accumulate into user_games totals. Zero-stub rows from handle_session_insert
-- remain untouched until a qualifying session closes.
create or replace function public.update_user_game_stats()
returns trigger
language plpgsql
as $function$
declare
  min_secs integer := public.get_min_session_duration_secs();
begin
  if new.game_id is null then
    return new;
  end if;
  if exists (select 1 from public.games where id = new.game_id and ignored = true) then
    return new;
  end if;
  if new.ended_at is not null
     and (old.ended_at is null or old.ended_at is distinct from new.ended_at)
     and coalesce(new.duration_secs, 0) >= min_secs then
    insert into public.user_games (user_id, game_id, total_time_secs, total_sessions, first_played, last_played, avg_session_secs)
    values (
      new.user_id, new.game_id,
      coalesce(new.duration_secs, 0), 1,
      new.started_at, new.ended_at,
      coalesce(new.duration_secs, 0)
    )
    on conflict (user_id, game_id)
    do update set
      total_time_secs = public.user_games.total_time_secs + coalesce(new.duration_secs, 0),
      total_sessions = public.user_games.total_sessions + 1,
      last_played = new.ended_at,
      avg_session_secs = (public.user_games.total_time_secs + coalesce(new.duration_secs, 0)) / (public.user_games.total_sessions + 1);
  end if;
  return new;
end;
$function$;

-- 4. Dashboard overview: today/week/month totals filtered by threshold.
-- live_session remains unfiltered so the "now playing" card renders
-- immediately after a session starts (duration is still 0 at that point).
create or replace function public.get_dashboard_overview(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  result json;
  min_secs integer := public.get_min_session_duration_secs();
begin
  select json_build_object(
    'today', (
      select json_build_object(
        'total_secs', coalesce(sum(gs.duration_secs), 0),
        'game_count', count(distinct coalesce(gs.game_id::text, gs.game_name))
      )
      from public.game_sessions gs
      left join public.games g on g.id = gs.game_id
      where gs.user_id = p_user_id
        and gs.started_at >= current_date
        and gs.duration_secs >= min_secs
        and (g.ignored is not true or gs.game_id is null)
    ),
    'this_week', (
      select json_build_object(
        'total_secs', coalesce(sum(gs.duration_secs), 0),
        'game_count', count(distinct coalesce(gs.game_id::text, gs.game_name))
      )
      from public.game_sessions gs
      left join public.games g on g.id = gs.game_id
      where gs.user_id = p_user_id
        and gs.started_at >= date_trunc('week', current_date)
        and gs.duration_secs >= min_secs
        and (g.ignored is not true or gs.game_id is null)
    ),
    'this_month', (
      select json_build_object(
        'total_secs', coalesce(sum(gs.duration_secs), 0),
        'game_count', count(distinct coalesce(gs.game_id::text, gs.game_name))
      )
      from public.game_sessions gs
      left join public.games g on g.id = gs.game_id
      where gs.user_id = p_user_id
        and gs.started_at >= date_trunc('month', current_date)
        and gs.duration_secs >= min_secs
        and (g.ignored is not true or gs.game_id is null)
    ),
    'live_session', (
      select json_build_object(
        'session_id', gs.id,
        'game_name', coalesce(g.name, gs.game_name),
        'game_cover', g.cover_url,
        'game_slug', g.slug,
        'started_at', gs.started_at,
        'source', gs.source
      )
      from public.game_sessions gs
      left join public.games g on g.id = gs.game_id
      where gs.user_id = p_user_id
        and gs.ended_at is null
        and (g.ignored is not true or gs.game_id is null)
      order by gs.started_at desc
      limit 1
    )
  ) into result;
  return result;
end;
$function$;

-- 5. Calendar heatmap: per-day play totals for a given month, filtered.
create or replace function public.get_calendar_data(p_user_id uuid, p_year integer, p_month integer)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  result json;
  min_secs integer := public.get_min_session_duration_secs();
begin
  select json_agg(day_data)
  into result
  from (
    select
      date_trunc('day', gs.started_at)::date as day,
      sum(gs.duration_secs) as total_secs,
      count(*) as session_count,
      count(distinct coalesce(gs.game_id::text, gs.game_name)) as game_count
    from public.game_sessions gs
    left join public.games g on g.id = gs.game_id
    where gs.user_id = p_user_id
      and extract(year from gs.started_at) = p_year
      and extract(month from gs.started_at) = p_month
      and gs.duration_secs >= min_secs
      and (g.ignored is not true or gs.game_id is null)
    group by date_trunc('day', gs.started_at)::date
    order by day
  ) day_data;
  return coalesce(result, '[]'::json);
end;
$function$;

-- 6. Play patterns (dow × hour heatmap), filtered.
create or replace function public.get_play_patterns(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  result json;
  min_secs integer := public.get_min_session_duration_secs();
begin
  select json_agg(pattern_data)
  into result
  from (
    select
      extract(dow from gs.started_at)::int as day_of_week,
      extract(hour from gs.started_at)::int as hour_of_day,
      sum(gs.duration_secs) as total_secs,
      count(*) as session_count
    from public.game_sessions gs
    left join public.games g on g.id = gs.game_id
    where gs.user_id = p_user_id
      and gs.duration_secs >= min_secs
      and (g.ignored is not true or gs.game_id is null)
    group by
      extract(dow from gs.started_at)::int,
      extract(hour from gs.started_at)::int
  ) pattern_data;
  return coalesce(result, '[]'::json);
end;
$function$;
