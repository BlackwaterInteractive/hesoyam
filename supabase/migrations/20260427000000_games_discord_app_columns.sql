-- Discord application metadata columns on `games` (issue #160).
--
-- The Discord public RPC endpoint (GET /applications/{id}/rpc) returns rich
-- metadata for any registered Discord application — including a curated
-- mapping from the Discord app id to the game's IGDB id and various
-- storefront SKUs. The resolver's new Tier 0c uses this endpoint to skip
-- fuzzy IGDB name search entirely when Discord knows the game (most
-- detectable games), eliminating the structural cause of #153-class
-- mismatches.
--
-- Columns:
--
--   discord_name      Discord's canonical app name (from RPC `name` field), or
--                     the original presence string when no RPC data is available.
--                     Closes #114.
--   discord_aliases   Alternate names from RPC `aliases` array. Useful for future
--                     name-based search disambiguation.
--   steam_app_id      Steam app id from `third_party_skus[distributor=steam]`.
--   gog_id            GOG product id from `third_party_skus[distributor=gop]`.
--   epic_id           Epic store id from `third_party_skus[distributor=epic]`.
--   xbox_app_id       Microsoft Store id from `third_party_skus[distributor=xbox]`.
--   opencritic_id     OpenCritic review aggregate id from
--                     `third_party_skus[distributor=opencritic]`.
--
-- All `text` to be format-flexible — some platforms use alphanumeric ids,
-- others integer-as-string with leading zeros, etc. We do not store the raw
-- third_party_skus JSONB: the columns above cover the distributors with
-- obvious UI use cases, and the Discord response is cacheable + re-fetchable
-- if we ever need other distributors.

alter table public.games
  add column if not exists discord_name      text,
  add column if not exists discord_aliases   text[],
  add column if not exists steam_app_id      text,
  add column if not exists gog_id            text,
  add column if not exists epic_id           text,
  add column if not exists xbox_app_id       text,
  add column if not exists opencritic_id     text;

comment on column public.games.discord_name is
  'Discord''s canonical app name from /applications/{id}/rpc, or the original presence string when no RPC data was available. Closes #114.';
comment on column public.games.discord_aliases is
  'Alternate names from Discord RPC `aliases` array.';
comment on column public.games.steam_app_id is
  'Steam app id, from Discord RPC third_party_skus[distributor=steam].';
comment on column public.games.gog_id is
  'GOG product id, from Discord RPC third_party_skus[distributor=gop].';
comment on column public.games.epic_id is
  'Epic store id, from Discord RPC third_party_skus[distributor=epic].';
comment on column public.games.xbox_app_id is
  'Microsoft Store id, from Discord RPC third_party_skus[distributor=xbox].';
comment on column public.games.opencritic_id is
  'OpenCritic review aggregate id, from Discord RPC third_party_skus[distributor=opencritic].';
