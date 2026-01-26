-- Get dashboard overview stats
create or replace function public.get_dashboard_overview(p_user_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  select json_build_object(
    'today', (
      select json_build_object(
        'total_secs', coalesce(sum(duration_secs), 0),
        'game_count', count(distinct game_id)
      )
      from public.game_sessions
      where user_id = p_user_id
        and started_at >= current_date
    ),
    'this_week', (
      select json_build_object(
        'total_secs', coalesce(sum(duration_secs), 0),
        'game_count', count(distinct game_id)
      )
      from public.game_sessions
      where user_id = p_user_id
        and started_at >= date_trunc('week', current_date)
    ),
    'this_month', (
      select json_build_object(
        'total_secs', coalesce(sum(duration_secs), 0),
        'game_count', count(distinct game_id)
      )
      from public.game_sessions
      where user_id = p_user_id
        and started_at >= date_trunc('month', current_date)
    ),
    'live_session', (
      select json_build_object(
        'session_id', gs.id,
        'game_name', g.name,
        'game_cover', g.cover_url,
        'started_at', gs.started_at
      )
      from public.game_sessions gs
      join public.games g on g.id = gs.game_id
      where gs.user_id = p_user_id
        and gs.ended_at is null
      order by gs.started_at desc
      limit 1
    )
  ) into result;
  return result;
end;
$$;

-- Get calendar heatmap data
create or replace function public.get_calendar_data(
  p_user_id uuid,
  p_year integer,
  p_month integer
)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  select json_agg(day_data)
  into result
  from (
    select
      date_trunc('day', started_at)::date as day,
      sum(duration_secs) as total_secs,
      count(*) as session_count,
      count(distinct game_id) as game_count
    from public.game_sessions
    where user_id = p_user_id
      and extract(year from started_at) = p_year
      and extract(month from started_at) = p_month
    group by date_trunc('day', started_at)::date
    order by day
  ) day_data;
  return coalesce(result, '[]'::json);
end;
$$;

-- Get genre distribution
create or replace function public.get_genre_stats(p_user_id uuid)
returns json
language plpgsql
security definer
as $$
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
    group by unnest(g.genres)
    order by total_secs desc
  ) genre_data;
  return coalesce(result, '[]'::json);
end;
$$;

-- Get play pattern heatmap (hour of day x day of week)
create or replace function public.get_play_patterns(p_user_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  select json_agg(pattern_data)
  into result
  from (
    select
      extract(dow from started_at)::int as day_of_week,
      extract(hour from started_at)::int as hour_of_day,
      sum(duration_secs) as total_secs,
      count(*) as session_count
    from public.game_sessions
    where user_id = p_user_id
    group by
      extract(dow from started_at)::int,
      extract(hour from started_at)::int
  ) pattern_data;
  return coalesce(result, '[]'::json);
end;
$$;
