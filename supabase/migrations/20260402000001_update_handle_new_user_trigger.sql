-- Update handle_new_user() to extract Discord metadata on OAuth signup.
-- Previously only copied id + email. Now also populates discord_id,
-- discord_connected_at, display_name, and avatar_url from OAuth metadata
-- when the provider is Discord. Also populates display_name + avatar_url
-- for all other OAuth providers.
--
-- The callback route (apps/web/src/app/(auth)/callback/route.ts:67-81)
-- stays as a redundant safety net but is no longer the primary path.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _provider TEXT;
  _discord_id TEXT;
  _display_name TEXT;
  _avatar_url TEXT;
BEGIN
  _provider := new.raw_app_meta_data->>'provider';

  IF _provider = 'discord' THEN
    _discord_id := new.raw_user_meta_data->>'provider_id';
    _display_name := COALESCE(
      new.raw_user_meta_data->'custom_claims'->>'global_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    );
    _avatar_url := new.raw_user_meta_data->>'avatar_url';
  ELSE
    _discord_id := NULL;
    _display_name := COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    );
    _avatar_url := new.raw_user_meta_data->>'avatar_url';
  END IF;

  INSERT INTO public.profiles (id, email, discord_id, discord_connected_at, display_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    _discord_id,
    CASE WHEN _discord_id IS NOT NULL THEN now() ELSE NULL END,
    _display_name,
    _avatar_url
  );

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS
  'Auto-creates a profile on signup. Extracts Discord ID and metadata from OAuth when provider is Discord.';
