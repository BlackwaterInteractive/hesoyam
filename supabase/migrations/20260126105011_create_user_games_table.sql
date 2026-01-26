create table public.user_games (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  total_time_secs integer not null default 0,
  total_sessions integer not null default 0,
  first_played timestamptz not null default now(),
  last_played timestamptz not null default now(),
  avg_session_secs integer not null default 0,
  primary key (user_id, game_id)
);

-- Trigger to update user_games when a session ends
create or replace function public.update_user_game_stats()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.ended_at is not null and (old.ended_at is null or old.ended_at is distinct from new.ended_at) then
    insert into public.user_games (user_id, game_id, total_time_secs, total_sessions, first_played, last_played, avg_session_secs)
    values (
      new.user_id,
      new.game_id,
      new.duration_secs,
      1,
      new.started_at,
      new.ended_at,
      new.duration_secs
    )
    on conflict (user_id, game_id) do update set
      total_time_secs = user_games.total_time_secs + new.duration_secs,
      total_sessions = user_games.total_sessions + 1,
      last_played = new.ended_at,
      avg_session_secs = (user_games.total_time_secs + new.duration_secs) / (user_games.total_sessions + 1);
  end if;
  return new;
end;
$$;

create trigger on_session_end
  after update on public.game_sessions
  for each row execute function public.update_user_game_stats();

-- Also handle direct inserts of completed sessions (batch upload)
create or replace function public.handle_session_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.ended_at is not null then
    insert into public.user_games (user_id, game_id, total_time_secs, total_sessions, first_played, last_played, avg_session_secs)
    values (
      new.user_id,
      new.game_id,
      new.duration_secs,
      1,
      new.started_at,
      new.ended_at,
      new.duration_secs
    )
    on conflict (user_id, game_id) do update set
      total_time_secs = user_games.total_time_secs + new.duration_secs,
      total_sessions = user_games.total_sessions + 1,
      last_played = greatest(user_games.last_played, new.ended_at),
      first_played = least(user_games.first_played, new.started_at),
      avg_session_secs = (user_games.total_time_secs + new.duration_secs) / (user_games.total_sessions + 1);
  end if;
  return new;
end;
$$;

create trigger on_session_insert
  after insert on public.game_sessions
  for each row execute function public.handle_session_insert();
