-- Add updated_at column to game_sessions for tracking stale sessions
alter table public.game_sessions
  add column if not exists updated_at timestamptz not null default now();

-- Create index for efficient stale session queries
create index if not exists game_sessions_updated_at_idx
  on public.game_sessions (updated_at)
  where ended_at is null;

-- Trigger to auto-update updated_at on any row update
create or replace function public.update_game_session_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists game_sessions_updated_at on public.game_sessions;
create trigger game_sessions_updated_at
  before update on public.game_sessions
  for each row
  execute function public.update_game_session_timestamp();

-- Function to close stale sessions (no update for 6 minutes)
-- Sessions are considered orphaned if:
-- 1. ended_at is NULL (still "live")
-- 2. updated_at is older than 6 minutes ago
create or replace function public.close_stale_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer;
begin
  with stale as (
    update public.game_sessions
    set
      ended_at = updated_at,  -- Use last update time as end time
      duration_secs = extract(epoch from (updated_at - started_at))::integer
    where
      ended_at is null
      and updated_at < now() - interval '6 minutes'
    returning id
  )
  select count(*) into closed_count from stale;

  return closed_count;
end;
$$;

-- Grant execute permission to authenticated users (for manual cleanup if needed)
grant execute on function public.close_stale_sessions() to authenticated;

-- Note: For automatic cleanup, set up a Supabase cron job (pg_cron) or
-- call this function periodically from the web app/edge function.
-- Example pg_cron (run in Supabase SQL editor with superuser):
-- select cron.schedule('close-stale-sessions', '*/5 * * * *', 'select public.close_stale_sessions()');
