"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteGameFolder } from "@/lib/imagekit";
import type { Json } from "@/lib/types";

export async function updateGame(
  gameId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    const name = formData.get("name") as string;
    const developer = formData.get("developer") as string | null;
    const publisher = formData.get("publisher") as string | null;
    const genresRaw = formData.get("genres") as string | null;
    const cover_url = formData.get("cover_url") as string | null;
    const ignored = formData.get("ignored") === "true";

    // Parse genres from comma-separated string to array
    const genres = genresRaw
      ? genresRaw
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : null;

    const { error } = await supabase
      .from("games")
      .update({
        name: name || undefined,
        developer: developer || null,
        publisher: publisher || null,
        genres,
        cover_url: cover_url || null,
        ignored,
      })
      .eq("id", gameId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/games");
    revalidatePath(`/games/${gameId}`);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export interface IgdbSearchResult {
  igdb_id: number;
  name: string;
  slug: string;
  cover_url: string | null;
  genres: string[];
  release_year: number | null;
  existing_game_id: string | null; // non-null if this igdb_id already exists in our DB
}

// Raw IGDB API response shape (from backend /games/search)
interface IgdbRawResult {
  id: number;
  name: string;
  slug: string;
  cover?: { image_id: string };
  genres?: { id: number; name: string }[];
  first_release_date?: number;
}

export async function searchIgdb(
  query: string
): Promise<{ results: IgdbSearchResult[]; error?: string }> {
  if (!query.trim()) return { results: [] };

  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) {
    return { results: [], error: "BACKEND_API_URL not configured" };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { results: [], error: "Not authenticated" };
  }

  try {
    const url = `${backendUrl}/games/search?query=${encodeURIComponent(query.trim())}&limit=10`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!res.ok) {
      return { results: [], error: `IGDB search failed (${res.status})` };
    }

    const rawData: IgdbRawResult[] = await res.json();

    // Check which igdb_ids already exist in our DB
    const igdbIds = rawData.map((r) => r.id);
    const admin = createAdminClient();
    const { data: existingGames } = await admin
      .from("games")
      .select("id, igdb_id")
      .in("igdb_id", igdbIds);

    const existingMap = new Map(
      (existingGames ?? []).map((g) => [g.igdb_id, g.id])
    );

    const results: IgdbSearchResult[] = rawData.map((raw) => ({
      igdb_id: raw.id,
      name: raw.name,
      slug: raw.slug,
      cover_url: raw.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${raw.cover.image_id}.jpg`
        : null,
      genres: raw.genres?.map((g) => g.name) ?? [],
      release_year: raw.first_release_date
        ? new Date(raw.first_release_date * 1000).getFullYear()
        : null,
      existing_game_id: existingMap.get(raw.id) ?? null,
    }));

    return { results };
  } catch (err) {
    return {
      results: [],
      error: err instanceof Error ? err.message : "Search failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Game remap (issue #154)
// ---------------------------------------------------------------------------
// Two-phase: getRemapPlan inspects (read-only) and returns the detected mode
// + diff data for the preview UI; remapGame applies under FOR UPDATE lock,
// re-checking mode to defend TOCTOU between plan and apply.
//
// Modes (PR 1 ships modes 1 & 2; mode 3 returns merge_required and is blocked
// in the UI until PR 2 lands `admin_merge_games`):
//   refresh                       — source already has the picked igdb_id
//   clean_retarget_no_target      — picked igdb_id has no row yet
//   clean_retarget_empty_target   — target row exists but has 0 FK refs
//   merge_required                — target has FKs (sessions / user_games / library)

export type RemapMode =
  | "refresh"
  | "clean_retarget_no_target"
  | "clean_retarget_empty_target"
  | "merge_required";

export interface IgdbMetadata {
  igdb_id: number;
  name: string;
  slug: string;
  cover_url: string | null;
  genres: string[];
  developer: string | null;
  publisher: string | null;
  release_year: number | null;
  description: string | null;
  first_release_date: string | null;
  screenshots: string[];
  artwork_url: string | null;
  rating: number | null;
  rating_count: number | null;
  platforms: string[];
}

export interface RemapFkCounts {
  sessions: number;
  user_games: number;
  library: number;
}

// Source row + target row are returned as the raw `games` row shape from the
// RPC (loose because schema may evolve). UI only reads the fields it cares about.
export type RemapGameRow = Record<string, unknown>;

export type RemapBlockReason = "source_ignored" | "target_ignored";

export interface UserGamesOverlapEntry {
  user_id: string;
  source_total_time_secs: number;
  source_total_sessions: number;
  source_first_played: string | null;
  source_last_played: string | null;
  target_total_time_secs: number;
  target_total_sessions: number;
  target_first_played: string | null;
  target_last_played: string | null;
  merged_total_time_secs: number;
  merged_total_sessions: number;
}

export interface LibraryOverlapEntry {
  user_id: string;
  source_status: string;
  source_personal_rating: number | null;
  source_added_at: string;
  target_status: string;
  target_personal_rating: number | null;
  target_added_at: string;
  survives: "target";
  curated: boolean;
}

export interface RemapWarning {
  type: "curated_library_drop";
  user_count: number;
}

export interface MergeDetails {
  block_reasons: RemapBlockReason[];
  user_games_overlap: UserGamesOverlapEntry[];
  library_overlap: LibraryOverlapEntry[];
  live_sessions_count: number;
  warnings: RemapWarning[];
}

export interface RemapPlan {
  mode: RemapMode;
  source: RemapGameRow;
  target_id: string | null;
  target: RemapGameRow | null;
  fk_counts: {
    source: RemapFkCounts;
    target: RemapFkCounts | null;
  };
  merge_details: MergeDetails | null;
}

export interface RemapPlanResponse {
  plan?: RemapPlan;
  igdbMetadata?: IgdbMetadata;
  error?: string;
}

export async function getRemapPlan(
  gameId: string,
  igdbId: number
): Promise<RemapPlanResponse> {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) {
    return { error: "BACKEND_API_URL not configured" };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { error: "Not authenticated" };
  }

  // 1. Fetch IGDB metadata (no DB write — new metadata-only endpoint).
  const metaRes = await fetch(
    `${backendUrl}/games/igdb/${igdbId}/metadata`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }
  );

  if (!metaRes.ok) {
    const body = await metaRes.text();
    return {
      error: `IGDB metadata fetch failed (${metaRes.status}): ${body}`,
    };
  }

  const igdbMetadata = (await metaRes.json()) as IgdbMetadata;

  // 2. Inspect DB state via the read-only plan RPC.
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_remap_plan", {
    p_source_id: gameId,
    p_target_igdb_id: igdbId,
  });

  if (error) {
    return { error: `Plan RPC failed: ${error.message}` };
  }

  const planJson = data as Record<string, unknown> | null;
  if (!planJson) {
    return { error: "Plan RPC returned null" };
  }
  if (typeof planJson.error === "string") {
    return { error: planJson.error };
  }

  return { plan: planJson as unknown as RemapPlan, igdbMetadata };
}

export interface RemapApplyResponse {
  success: boolean;
  mode?: RemapMode;
  deletedTargetId?: string | null;
  error?: string;
  expectedMode?: RemapMode;
  actualMode?: RemapMode;
  blockReasons?: RemapBlockReason[];
}

// Dispatch entry point: chooses admin_remap_apply (modes 1/2) or
// admin_merge_games (mode 3) based on the plan-derived `expectedMode`.
// targetId is required when expectedMode === 'merge_required' (for the
// merge RPC's by-id lookup); plan response provides it.
export async function remapGame(
  gameId: string,
  igdbId: number,
  igdbMetadata: IgdbMetadata,
  expectedMode: RemapMode,
  targetId: string | null = null
): Promise<RemapApplyResponse> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  const admin = createAdminClient();

  // Mode 3: dispatch to admin_merge_games (atomic merge with FK reassignment).
  if (expectedMode === "merge_required") {
    if (!targetId) {
      return { success: false, error: "merge_required mode requires targetId" };
    }

    const { data, error } = await admin.rpc("admin_merge_games", {
      p_source_id: gameId,
      p_target_id: targetId,
      p_metadata: igdbMetadata as unknown as Json,
      p_actor_id: session.user.id,
    });

    if (error) {
      return { success: false, error: `Merge RPC failed: ${error.message}` };
    }

    const result = data as Record<string, unknown> | null;
    if (!result) {
      return { success: false, error: "Merge RPC returned null" };
    }

    if (result.error === "merge_blocked") {
      return {
        success: false,
        error: "merge_blocked",
        blockReasons: (result.block_reasons as RemapBlockReason[]) ?? [],
      };
    }
    if (typeof result.error === "string") {
      return { success: false, error: result.error };
    }

    // Identity changed: clean up enriched assets in ImageKit. DB columns are
    // cleared inside admin_merge_games (see migration 20260428010000); this
    // wipes the matching ImageKit folders. Best-effort — orphans are recoverable.
    const deletedTargetId = (result.deleted_target_id as string | null) ?? null;
    await deleteGameFolder(gameId);
    if (deletedTargetId) await deleteGameFolder(deletedTargetId);

    revalidatePath("/games");
    revalidatePath(`/games/${gameId}`);

    return {
      success: true,
      mode: "merge_required",
      deletedTargetId,
    };
  }

  // Modes 1 & 2: admin_remap_apply with TOCTOU defense via expected_mode.
  const { data, error } = await admin.rpc("admin_remap_apply", {
    p_source_id: gameId,
    p_target_igdb_id: igdbId,
    p_metadata: igdbMetadata as unknown as Json,
    p_expected_mode: expectedMode,
    p_actor_id: session.user.id,
  });

  if (error) {
    return { success: false, error: `Apply RPC failed: ${error.message}` };
  }

  const result = data as Record<string, unknown> | null;
  if (!result) {
    return { success: false, error: "Apply RPC returned null" };
  }

  if (result.error === "mode_mismatch") {
    return {
      success: false,
      error: "mode_mismatch",
      expectedMode: result.expected as RemapMode,
      actualMode: result.actual as RemapMode,
    };
  }
  if (result.error === "merge_required") {
    return { success: false, error: "merge_required" };
  }
  if (typeof result.error === "string") {
    return { success: false, error: result.error };
  }

  const actualMode = result.mode as RemapMode;
  const deletedTargetId = (result.deleted_target_id as string | null) ?? null;

  // For modes that change identity, the DB-side admin_remap_apply has already
  // cleared the row's steamgriddb_* + assets_enriched columns. Mirror that on
  // the ImageKit side with a best-effort folder delete. Refresh mode skips —
  // identity didn't change so the curated assets are still valid.
  if (actualMode !== "refresh") {
    await deleteGameFolder(gameId);
    if (deletedTargetId) await deleteGameFolder(deletedTargetId);
  }

  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);

  return {
    success: true,
    mode: actualMode,
    deletedTargetId,
  };
}

export async function syncFromIgdb(
  gameId: string,
  igdbId: number
): Promise<{ success: boolean; error?: string }> {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) {
    return { success: false, error: "BACKEND_API_URL not configured" };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  // Call importById which fetches latest IGDB data and upserts by igdb_id
  // Since this game already has this igdb_id, it updates in place
  const res = await fetch(`${backendUrl}/games/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ igdbId }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `Sync failed (${res.status}): ${body}` };
  }

  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Game delete (admin dashboard, separate from remap)
// ---------------------------------------------------------------------------
// Plan/Apply pattern, same shape as remap. Plan inspects (read-only); apply
// mutates under FOR UPDATE lock with a TOCTOU re-check.
//
// Block reasons (returned by both plan and apply):
//   live_sessions — at least one game_sessions row with ended_at IS NULL.
//                   Admin must let live sessions end before delete proceeds.

export type DeleteBlockReason = "live_sessions";

export interface DeletePlanFkCounts {
  sessions: number;
  user_games: number;
  library: number;
  live_sessions: number;
  users_affected: number;
}

export interface DeletePerUserEntry {
  user_id: string;
  sessions: number;
  total_time_secs: number;
  has_user_games: boolean;
  has_library: boolean;
}

export interface DeletePlan {
  game: RemapGameRow;
  fk_counts: DeletePlanFkCounts;
  per_user: DeletePerUserEntry[];
  block_reasons: DeleteBlockReason[];
}

export interface DeletePlanResponse {
  plan?: DeletePlan;
  error?: string;
}

export async function getDeletePlan(
  gameId: string
): Promise<DeletePlanResponse> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_delete_game_plan", {
    p_game_id: gameId,
  });

  if (error) {
    return { error: `Plan RPC failed: ${error.message}` };
  }

  const planJson = data as Record<string, unknown> | null;
  if (!planJson) {
    return { error: "Plan RPC returned null" };
  }
  if (typeof planJson.error === "string") {
    return { error: planJson.error };
  }

  return { plan: planJson as unknown as DeletePlan };
}

export interface DeleteApplyResponse {
  success: boolean;
  deletedGameId?: string;
  sessionsDeleted?: number;
  userGamesDeleted?: number;
  libraryDeleted?: number;
  error?: string;
  blockReasons?: DeleteBlockReason[];
}

export async function deleteGame(
  gameId: string
): Promise<DeleteApplyResponse> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_delete_game", {
    p_game_id: gameId,
    p_actor_id: session.user.id,
  });

  if (error) {
    return { success: false, error: `Delete RPC failed: ${error.message}` };
  }

  const result = data as Record<string, unknown> | null;
  if (!result) {
    return { success: false, error: "Delete RPC returned null" };
  }

  if (result.error === "delete_blocked") {
    return {
      success: false,
      error: "delete_blocked",
      blockReasons: (result.block_reasons as DeleteBlockReason[]) ?? [],
    };
  }
  if (typeof result.error === "string") {
    return { success: false, error: result.error };
  }

  revalidatePath("/games");

  return {
    success: true,
    deletedGameId: (result.deleted_game_id as string) ?? gameId,
    sessionsDeleted: (result.sessions_deleted as number) ?? 0,
    userGamesDeleted: (result.user_games_deleted as number) ?? 0,
    libraryDeleted: (result.library_deleted as number) ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Consolidate Games (issue #194 PR 2)
// ---------------------------------------------------------------------------
// Folds an orphan `games` row (e.g. the Delta Force companion bot's
// auto-created row) into the canonical row representing the same real
// game. Distinct from Remap-merge (Mode 3): canonical's identity is
// preserved entirely; orphan's data is folded in (overlapping sessions
// deleted as duplicates, distinct ones repointed, junction rows moved,
// orphan deleted).
//
// Three-phase: candidates (auto-suggest) → plan (preview) → apply.
// After apply, a best-effort hit to the backend's cache-invalidate
// endpoint drops the resolver LRU so the next presence event for any
// moved application id re-resolves to the canonical row instead of
// the now-deleted orphan id.

export interface ConsolidationCandidate {
  orphan_id: string;
  orphan_name: string;
  canonical_id: string | null;
  canonical_name: string | null;
  reason: "time_overlap" | "orphan_shape";
  signal_strength: number;
}

export async function getConsolidationCandidates(): Promise<{
  candidates: ConsolidationCandidate[];
  error?: string;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_consolidation_candidates");

  if (error) {
    return { candidates: [], error: `Candidates RPC failed: ${error.message}` };
  }

  return { candidates: (data as ConsolidationCandidate[] | null) ?? [] };
}

export type ConsolidationBlockReason = "orphan_ignored" | "canonical_ignored";

export interface ConsolidationPlan {
  orphan: RemapGameRow;
  canonical: RemapGameRow;
  sessions_overlapping: number;
  sessions_distinct: number;
  library_overlapping: number;
  library_distinct: number;
  application_ids: string[];
  block_reasons: ConsolidationBlockReason[];
}

export interface ConsolidationPlanResponse {
  plan?: ConsolidationPlan;
  error?: string;
}

export async function getConsolidationPlan(
  orphanId: string,
  canonicalId: string,
): Promise<ConsolidationPlanResponse> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_consolidate_games_plan", {
    p_orphan_id: orphanId,
    p_canonical_id: canonicalId,
  });

  if (error) {
    return { error: `Plan RPC failed: ${error.message}` };
  }

  const planJson = data as Record<string, unknown> | null;
  if (!planJson) {
    return { error: "Plan RPC returned null" };
  }
  if (typeof planJson.error === "string") {
    return { error: planJson.error };
  }

  return { plan: planJson as unknown as ConsolidationPlan };
}

export interface ConsolidationApplyResponse {
  success: boolean;
  orphanId?: string;
  canonicalId?: string;
  sessionsDeleted?: number;
  sessionsRepointed?: number;
  libraryDeleted?: number;
  libraryRepointed?: number;
  movedApplicationIds?: string[];
  cacheInvalidated?: boolean;
  error?: string;
  blockReasons?: ConsolidationBlockReason[];
}

export async function consolidateGames(
  orphanId: string,
  canonicalId: string,
): Promise<ConsolidationApplyResponse> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_consolidate_games", {
    p_orphan_id: orphanId,
    p_canonical_id: canonicalId,
    p_actor_id: session.user.id,
  });

  if (error) {
    return { success: false, error: `Consolidate RPC failed: ${error.message}` };
  }

  const result = data as Record<string, unknown> | null;
  if (!result) {
    return { success: false, error: "Consolidate RPC returned null" };
  }

  if (result.error === "consolidate_blocked") {
    return {
      success: false,
      error: "consolidate_blocked",
      blockReasons:
        (result.block_reasons as ConsolidationBlockReason[]) ?? [],
    };
  }
  if (typeof result.error === "string") {
    return { success: false, error: result.error };
  }

  const movedApplicationIds =
    (result.moved_application_ids as string[] | null) ?? [];

  // Best-effort cache invalidation. The DB merge is the source of truth;
  // a cache-invalidate failure is recoverable (1h TTL or backend restart),
  // so we don't fail the whole action if the backend is unreachable.
  let cacheInvalidated = false;
  const backendUrl = process.env.BACKEND_API_URL;
  if (backendUrl && movedApplicationIds.length > 0) {
    try {
      const res = await fetch(
        `${backendUrl}/games/cache/invalidate-application-ids`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ applicationIds: movedApplicationIds }),
        },
      );
      cacheInvalidated = res.ok;
    } catch {
      cacheInvalidated = false;
    }
  } else {
    cacheInvalidated = movedApplicationIds.length === 0;
  }

  // Best-effort cleanup of orphan's enriched ImageKit assets (if any).
  // Mirrors the admin_remap / admin_delete pattern.
  await deleteGameFolder(orphanId);

  revalidatePath("/games");
  revalidatePath(`/games/${canonicalId}`);

  return {
    success: true,
    orphanId: result.orphan_id as string,
    canonicalId: result.canonical_id as string,
    sessionsDeleted: (result.sessions_deleted as number) ?? 0,
    sessionsRepointed: (result.sessions_repointed as number) ?? 0,
    libraryDeleted: (result.library_deleted as number) ?? 0,
    libraryRepointed: (result.library_repointed as number) ?? 0,
    movedApplicationIds,
    cacheInvalidated,
  };
}

export async function searchGamesForConsolidation(
  query: string,
  limit = 15,
): Promise<{
  results: { id: string; name: string; igdb_id: number | null; cover_url: string | null; metadata_source: string | null }[];
  error?: string;
}> {
  if (!query.trim()) return { results: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("games")
    .select("id, name, igdb_id, cover_url, metadata_source")
    .ilike("name", `%${query.trim()}%`)
    .order("name")
    .limit(limit);

  if (error) {
    return { results: [], error: `Game search failed: ${error.message}` };
  }
  return { results: data ?? [] };
}
