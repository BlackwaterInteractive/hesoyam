-- Enable RLS on the new federation table and add a public-read policy
-- matching the existing `games` table pattern. Resolver writes go through
-- the service-role key (which bypasses RLS); only read access is exposed
-- via PostgREST.
--
-- Pulled into a follow-up migration to keep the schema-shape change
-- (20260504000000) and the auth-policy decision separate.

alter table public.game_discord_applications enable row level security;

create policy "Game-Discord application links are viewable by everyone"
  on public.game_discord_applications
  for select
  to anon, authenticated
  using (true);
