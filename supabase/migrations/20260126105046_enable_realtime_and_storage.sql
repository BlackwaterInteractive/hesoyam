-- Enable realtime on game_sessions for live session tracking
alter publication supabase_realtime add table public.game_sessions;

-- Storage bucket for avatars
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'avatars');

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
