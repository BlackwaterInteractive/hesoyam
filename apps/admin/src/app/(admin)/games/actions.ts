"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

export async function remapGame(
  gameId: string,
  igdbId: number
): Promise<{ success: boolean; error?: string }> {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) {
    return { success: false, error: "BACKEND_API_URL not configured" };
  }

  // Step 1: Call backend importById to fetch full IGDB data (developer, publisher, etc.)
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

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
    return { success: false, error: `Import failed (${res.status}): ${body}` };
  }

  // Step 2: Read the full imported game from DB (importById upserts by igdb_id)
  const admin = createAdminClient();
  const { data: importedGame } = await admin
    .from("games")
    .select("*")
    .eq("igdb_id", igdbId)
    .single();

  if (!importedGame) {
    return { success: false, error: "Imported game not found in DB" };
  }

  // Step 3: If the imported game is a different record than our target, copy data over
  if (importedGame.id !== gameId) {
    // Copy all IGDB metadata to our target game, preserving discord_application_id
    const { error: updateError } = await admin
      .from("games")
      .update({
        igdb_id: importedGame.igdb_id,
        name: importedGame.name,
        slug: importedGame.slug + "-remapped-" + Date.now(), // avoid unique constraint conflict temporarily
        cover_url: importedGame.cover_url,
        genres: importedGame.genres,
        developer: importedGame.developer,
        publisher: importedGame.publisher,
        release_year: importedGame.release_year,
        description: importedGame.description,
        platforms: importedGame.platforms,
        screenshots: importedGame.screenshots,
        artwork_url: importedGame.artwork_url,
        igdb_url: importedGame.igdb_url,
        rating: importedGame.rating,
        rating_count: importedGame.rating_count,
        first_release_date: importedGame.first_release_date,
        metadata_source: "igdb",
        igdb_updated_at: new Date().toISOString(),
        // discord_application_id is intentionally NOT updated
      })
      .eq("id", gameId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Delete the duplicate imported record (its data is now on our target game)
    // Clear igdb_id on imported game first to avoid unique constraint on our target
    await admin.from("games").delete().eq("id", importedGame.id);

    // Now set the correct slug on our target
    await admin
      .from("games")
      .update({ slug: importedGame.slug })
      .eq("id", gameId);
  }
  // If same record, importById already updated it — nothing more to do

  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);
  return { success: true };
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

