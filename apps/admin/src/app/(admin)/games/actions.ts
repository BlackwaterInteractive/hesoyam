"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
    const discord_application_id = formData.get("discord_application_id") as string | null;
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
        discord_application_id: discord_application_id || null,
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

export interface RemapPlan {
  mode: RemapMode;
  source: RemapGameRow;
  target_id: string | null;
  target: RemapGameRow | null;
  fk_counts: {
    source: RemapFkCounts;
    target: RemapFkCounts | null;
  };
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
}

export async function remapGame(
  gameId: string,
  igdbId: number,
  igdbMetadata: IgdbMetadata,
  expectedMode: RemapMode
): Promise<RemapApplyResponse> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  const admin = createAdminClient();
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

  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);

  return {
    success: true,
    mode: result.mode as RemapMode,
    deletedTargetId: (result.deleted_target_id as string | null) ?? null,
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

