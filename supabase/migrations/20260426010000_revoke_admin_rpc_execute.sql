-- Revoke EXECUTE on SECURITY DEFINER admin RPCs from anon / authenticated / PUBLIC.
--
-- Closes the surface flagged in self-review of #155 (issue #157):
--
--   The four functions below are SECURITY DEFINER and run with the function
--   owner's privileges, bypassing RLS. By Postgres default, functions in the
--   public schema have EXECUTE granted to PUBLIC, which Supabase extends to
--   anon and authenticated. Combined with SECURITY DEFINER, that meant any
--   authenticated user could call these RPCs directly via the Supabase REST
--   API (POST /rest/v1/rpc/<name>) and remap, merge, or reconcile arbitrary
--   `games` rows.
--
-- Legitimate callers all use the service_role key:
--   * apps/admin via createAdminClient()
--   * apps/backend via SupabaseService (SUPABASE_SERVICE_KEY)
--
-- service_role retains EXECUTE, so no functional change.

revoke execute on function
  public.admin_remap_plan(uuid, integer),
  public.admin_remap_apply(uuid, integer, jsonb, text, uuid),
  public.admin_merge_games(uuid, uuid, jsonb, uuid),
  public.reconcile_orphan_game(uuid, jsonb)
from public, anon, authenticated;
