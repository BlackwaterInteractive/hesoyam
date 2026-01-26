-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.process_signatures enable row level security;
alter table public.game_sessions enable row level security;
alter table public.user_games enable row level security;

-- PROFILES
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  to authenticated, anon
  using (privacy = 'public' or id = (select auth.uid()));

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- GAMES (read-only for all)
create policy "Games are viewable by everyone"
  on public.games for select
  to authenticated, anon
  using (true);

-- PROCESS_SIGNATURES
create policy "Signatures are viewable by everyone"
  on public.process_signatures for select
  to authenticated
  using (true);

create policy "Authenticated users can report signatures"
  on public.process_signatures for insert
  to authenticated
  with check ((select auth.uid()) = reported_by);

-- GAME_SESSIONS
create policy "Users can view own sessions"
  on public.game_sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own sessions"
  on public.game_sessions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own sessions"
  on public.game_sessions for update
  to authenticated
  using ((select auth.uid()) = user_id);

-- USER_GAMES
create policy "Users can view own game stats"
  on public.user_games for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Public user game stats are viewable"
  on public.user_games for select
  to authenticated, anon
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = user_games.user_id
      and profiles.privacy = 'public'
    )
  );
