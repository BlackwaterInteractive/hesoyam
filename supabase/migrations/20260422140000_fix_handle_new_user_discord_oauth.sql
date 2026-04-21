-- Fix staging drift: handle_new_user Discord OAuth display_name path
--
-- Staging was reading `raw_user_meta_data->>'global_name'` directly; the
-- correct path for Supabase Discord OAuth is
-- `raw_user_meta_data->'custom_claims'->>'global_name'`. Prod has had the
-- correct logic for a while; this migration is a no-op on prod and a heal
-- on staging. Also restructures to provider-first branching with local
-- vars for clarity.
--
-- Legacy profile rows (Discord signups created before this fix on staging)
-- keep their incorrect/NULL display_name — not backfilled. Those are test
-- accounts; not worth the cycles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  _provider text;
  _discord_id text;
  _display_name text;
  _avatar_url text;
begin
  _provider := new.raw_app_meta_data->>'provider';

  if _provider = 'discord' then
    _discord_id := new.raw_user_meta_data->>'provider_id';
    _display_name := coalesce(
      new.raw_user_meta_data->'custom_claims'->>'global_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    );
    _avatar_url := new.raw_user_meta_data->>'avatar_url';
  else
    _discord_id := null;
    _display_name := coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    );
    _avatar_url := new.raw_user_meta_data->>'avatar_url';
  end if;

  insert into public.profiles (id, email, discord_id, discord_connected_at, display_name, avatar_url)
  values (
    new.id,
    new.email,
    _discord_id,
    case when _discord_id is not null then now() else null end,
    _display_name,
    _avatar_url
  );

  return new;
end;
$function$;
