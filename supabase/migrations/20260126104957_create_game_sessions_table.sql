create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_secs integer not null default 0,
  active_secs integer not null default 0,
  idle_secs integer not null default 0,
  created_at timestamptz not null default now()
);

create index game_sessions_user_started_idx on public.game_sessions (user_id, started_at desc);
create index game_sessions_user_game_idx on public.game_sessions (user_id, game_id);
create index game_sessions_ended_at_idx on public.game_sessions (ended_at) where ended_at is null;
