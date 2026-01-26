create table public.process_signatures (
  id uuid primary key default gen_random_uuid(),
  process_name text not null,
  game_id uuid not null references public.games(id) on delete cascade,
  reported_by uuid references public.profiles(id) on delete set null,
  confirmed_count integer not null default 1,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (process_name, game_id)
);

create index process_signatures_process_name_idx on public.process_signatures (process_name);
create index process_signatures_status_idx on public.process_signatures (status);
