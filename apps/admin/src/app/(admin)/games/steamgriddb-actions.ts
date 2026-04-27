"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  type AssetSlot,
  deleteFilesByName,
  deleteGameFolder,
  fileNameFromUrl,
  gameAssetFolder,
  getClientUploadAuth,
  uploadFromUrl,
} from "@/lib/imagekit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SteamGridDbLookupMode = "name" | "steam_id" | "steamgriddb_id";

export interface SteamGridDbGame {
  id: number;
  name: string;
  release_date: number | null;
  types: string[];
  verified?: boolean;
}

export interface SteamGridDbAsset {
  id: number;
  url: string;
  thumb: string;
  width: number;
  height: number;
  style?: string;
  mime?: string;
  upvotes: number;
  author: { name: string };
}

export interface SteamGridDbAssetSet {
  icons: SteamGridDbAsset[];
  logos: SteamGridDbAsset[];
  heroes: SteamGridDbAsset[];
  grids: SteamGridDbAsset[];
}

export type PickSource =
  | { type: "steamgriddb"; sourceUrl: string }
  | { type: "url"; sourceUrl: string }
  | { type: "manual"; imageKitUrl: string }
  | { type: "skip" };

export interface SaveCurationInput {
  gameId: string;
  steamGridDbGameId: number | null;
  picks: Partial<Record<AssetSlot, PickSource>>;
}

export interface UpdateSingleSlotInput {
  gameId: string;
  slot: AssetSlot;
  pick: PickSource;
}

export interface UploadAuth {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
}

// ---------------------------------------------------------------------------
// Module-scoped caches (process-local; survive across requests on the same
// server instance, evicted on cold start). Cheap defense against repeat
// lookups during a single curation session.
// ---------------------------------------------------------------------------

const LOOKUP_TTL_MS = 60_000;
const ASSET_TTL_MS = 5 * 60_000;

const lookupCache = new Map<
  string,
  { data: SteamGridDbGame[]; expiresAt: number }
>();
const assetCache = new Map<
  number,
  { data: SteamGridDbAssetSet; expiresAt: number }
>();
// Per-(gameId, slot, page) cache for "load more" pagination. Keyed by
// `${gameId}:${slot}:${page}` so paging back-and-forth on the same slot
// doesn't re-hit SGDB.
const slotPageCache = new Map<
  string,
  { data: SteamGridDbAsset[]; expiresAt: number }
>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SGDB_BASE = "https://www.steamgriddb.com/api/v2";

// SGDB endpoint path per slot (without leading /games-id and without query).
const SLOT_ENDPOINT: Record<AssetSlot, string> = {
  grid: "grids",
  icon: "icons",
  hero: "heroes",
  logo: "logos",
};

// Whether each slot's endpoint accepts the &epilepsy=false content filter.
// SGDB rejects the param on logos and grids endpoints — they're warning-free
// asset categories — so we omit it there.
const SLOT_SUPPORTS_EPILEPSY: Record<AssetSlot, boolean> = {
  grid: false,
  icon: true,
  hero: true,
  logo: false,
};

function buildSlotQuery(slot: AssetSlot, gameId: number, page: number): string {
  const epilepsy = SLOT_SUPPORTS_EPILEPSY[slot] ? "&epilepsy=false" : "";
  // SGDB pagination is 0-indexed; we keep `page` 1-indexed everywhere else
  // (dialog state, cache keys, action signatures) and translate only here.
  return `/${SLOT_ENDPOINT[slot]}/game/${gameId}?humor=false&nsfw=false${epilepsy}&types=static,animated&page=${page - 1}`;
}

const SLOT_COLUMN: Record<AssetSlot, string> = {
  grid: "steamgriddb_grid_url",
  icon: "steamgriddb_icon_url",
  hero: "steamgriddb_hero_url",
  logo: "steamgriddb_logo_url",
};

const ALL_SLOTS: AssetSlot[] = ["grid", "icon", "hero", "logo"];

function steamGridDbHeaders(): HeadersInit {
  const key = process.env.STEAMGRIDDB_API_KEY;
  if (!key) throw new Error("STEAMGRIDDB_API_KEY missing");
  return { Authorization: `Bearer ${key}` };
}

async function requireSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

// Cache-busting version stamp. ImageKit file paths are deterministic
// (/games/{id}/{slot}.jpg) so re-uploads overwrite cleanly, but every
// cache layer (browser, ImageKit edge, ISP) keys on the URL string and
// would serve stale bytes after an overwrite. Appending ?v={ts} produces
// a fresh cache key per save while keeping the underlying file path
// stable. ImageKit ignores unknown query params, so transforms (?tr=...)
// still work when consumers append them.
function withCacheBuster(url: string): string {
  const stamp = Date.now();
  return url.includes("?") ? `${url}&v=${stamp}` : `${url}?v=${stamp}`;
}

// Defense in depth: manual uploads are direct-to-ImageKit via signature, so
// the returned URL must live inside this game's ImageKit folder. Anything
// else is either a misconfigured client or an attempt to record a foreign
// URL. Returns the expected prefix string (caller compares with startsWith).
function expectedManualPrefix(gameId: string): string {
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!endpoint) throw new Error("IMAGEKIT_URL_ENDPOINT missing");
  return `${endpoint.replace(/\/$/, "")}${gameAssetFolder(gameId)}/`;
}

// Validates a paste-URL pick (issue #179). Admin pastes an arbitrary URL,
// the server hands it to ImageKit's URL-import via uploadFromUrl. Two checks:
// must parse as a URL, must be https. Trust boundary noted below.
//
// SSRF: this opens a new code path where the server (well, ImageKit's fetcher
// on our behalf) hits an admin-supplied URL. Mitigations: (1) admin-only,
// behind auth; (2) https requirement blocks plain-HTTP link-local services;
// (3) ImageKit fetches from its infra, not our VPC, so internal-network
// targets aren't actually reachable from the request path. We accept this
// risk; if the threat model changes, add a host allowlist or a private-IP
// resolve check before forwarding to uploadFromUrl.
function validatePasteUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "URL is empty" };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "URL is not parseable" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "URL must use https://" };
  }
  return { ok: true, url: parsed.toString() };
}

// Compute whether the OLD file for a slot is now an orphan, given the slot's
// before/after URLs. Two cases produce orphans:
//   1. Slot dropped: old URL was set, new is null → old file is orphan.
//   2. Slot format changed: extensions differ (e.g. PNG → GIF, where each
//      lives at a different path) → old-extension file is orphan, new-
//      extension file is what the DB now points at.
// Returns the old file's name to delete, or null if there's nothing to clean.
function computeSlotOrphan(
  oldUrl: string | null | undefined,
  newUrl: string | undefined,
): string | null {
  if (!oldUrl) return null;
  const oldFile = fileNameFromUrl(oldUrl);
  if (!oldFile) return null;
  if (!newUrl) return oldFile; // slot dropped
  const newFile = fileNameFromUrl(newUrl);
  if (newFile && newFile !== oldFile) return oldFile; // extension changed
  return null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function lookupSteamGridDb(input: {
  mode: SteamGridDbLookupMode;
  value: string;
}): Promise<{ success: boolean; data?: SteamGridDbGame[]; error?: string }> {
  const value = input.value.trim();
  if (!value) return { success: true, data: [] };

  const cacheKey = `${input.mode}:${value.toLowerCase()}`;
  const cached = lookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { success: true, data: cached.data };
  }

  let url: string;
  switch (input.mode) {
    case "name":
      url = `${SGDB_BASE}/search/autocomplete/${encodeURIComponent(value)}`;
      break;
    case "steam_id":
      url = `${SGDB_BASE}/games/steam/${encodeURIComponent(value)}`;
      break;
    case "steamgriddb_id":
      url = `${SGDB_BASE}/games/id/${encodeURIComponent(value)}`;
      break;
  }

  try {
    const res = await fetch(url, {
      headers: steamGridDbHeaders(),
      cache: "no-store",
    });

    if (res.status === 404) {
      lookupCache.set(cacheKey, { data: [], expiresAt: Date.now() + LOOKUP_TTL_MS });
      return { success: true, data: [] };
    }
    if (!res.ok) {
      return {
        success: false,
        error: `SteamGridDB ${input.mode} lookup failed (${res.status})`,
      };
    }

    const json = (await res.json()) as {
      success?: boolean;
      data?: SteamGridDbGame | SteamGridDbGame[] | null;
    };
    const list: SteamGridDbGame[] = Array.isArray(json.data)
      ? json.data
      : json.data
      ? [json.data]
      : [];
    const trimmed = list.slice(0, 10);

    lookupCache.set(cacheKey, {
      data: trimmed,
      expiresAt: Date.now() + LOOKUP_TTL_MS,
    });
    return { success: true, data: trimmed };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "SteamGridDB lookup failed",
    };
  }
}

// Internal helper: fetch one slot's results for one page, with cache.
// Used by both the bulk initial load (fetchSteamGridDbAssets) and the
// per-slot pagination action (fetchSlotAssetsPage).
async function fetchOneSlotPage(
  steamGridDbGameId: number,
  slot: AssetSlot,
  page: number,
): Promise<SteamGridDbAsset[]> {
  const cacheKey = `${steamGridDbGameId}:${slot}:${page}`;
  const cached = slotPageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const url = `${SGDB_BASE}${buildSlotQuery(slot, steamGridDbGameId, page)}`;
  const res = await fetch(url, {
    headers: steamGridDbHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) {
    slotPageCache.set(cacheKey, { data: [], expiresAt: Date.now() + ASSET_TTL_MS });
    return [];
  }
  if (!res.ok) {
    throw new Error(`SteamGridDB ${slot} fetch failed (${res.status})`);
  }
  const json = (await res.json()) as { data?: SteamGridDbAsset[] };
  const data = json.data ?? [];
  slotPageCache.set(cacheKey, { data, expiresAt: Date.now() + ASSET_TTL_MS });
  return data;
}

export async function fetchSteamGridDbAssets(
  steamGridDbGameId: number,
): Promise<{ success: boolean; data?: SteamGridDbAssetSet; error?: string }> {
  const cached = assetCache.get(steamGridDbGameId);
  if (cached && cached.expiresAt > Date.now()) {
    return { success: true, data: cached.data };
  }

  // Always include animated variants (issue #170). SteamGridDB defaults to
  // types=static; we override to surface GIF / animated WebP assets too.
  // Grids: no dimensions filter — picker shows whatever sizes SGDB has.
  // Initial load = page 1 of all 4 slots in parallel; pagination ("Load more")
  // goes through fetchSlotAssetsPage below.
  try {
    const [grids, icons, heroes, logos] = await Promise.all([
      fetchOneSlotPage(steamGridDbGameId, "grid", 1),
      fetchOneSlotPage(steamGridDbGameId, "icon", 1),
      fetchOneSlotPage(steamGridDbGameId, "hero", 1),
      fetchOneSlotPage(steamGridDbGameId, "logo", 1),
    ]);
    const data: SteamGridDbAssetSet = { grids, icons, heroes, logos };
    assetCache.set(steamGridDbGameId, {
      data,
      expiresAt: Date.now() + ASSET_TTL_MS,
    });
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "SteamGridDB asset fetch failed",
    };
  }
}

// "Load more" pagination for one slot. Returns this page's results plus a
// hasMore hint (true if SGDB returned a full page, suggesting more exist).
export async function fetchSlotAssetsPage(input: {
  steamGridDbGameId: number;
  slot: AssetSlot;
  page: number;
}): Promise<{
  success: boolean;
  data?: SteamGridDbAsset[];
  hasMore?: boolean;
  error?: string;
}> {
  if (input.page < 1) {
    return { success: false, error: "page must be >= 1" };
  }
  try {
    const data = await fetchOneSlotPage(
      input.steamGridDbGameId,
      input.slot,
      input.page,
    );
    return { success: true, data, hasMore: data.length >= 50 };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "SteamGridDB asset fetch failed",
    };
  }
}

export async function getUploadAuth(): Promise<{
  success: boolean;
  data?: UploadAuth;
  error?: string;
}> {
  try {
    await requireSession();
    return { success: true, data: getClientUploadAuth() };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "ImageKit auth failed",
    };
  }
}

export async function saveCuration(
  input: SaveCurationInput,
): Promise<{ success: boolean; error?: string }> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Auth failed" };
  }

  const { gameId, steamGridDbGameId, picks } = input;

  let manualPrefix: string;
  try {
    manualPrefix = expectedManualPrefix(gameId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Config missing" };
  }

  const hasAnyPick = ALL_SLOTS.some((slot) => {
    const p = picks[slot];
    return p && p.type !== "skip";
  });
  if (!hasAnyPick) {
    return {
      success: false,
      error: "At least one asset slot must have a pick or upload",
    };
  }

  for (const slot of ALL_SLOTS) {
    const pick = picks[slot];
    if (pick?.type === "manual" && !pick.imageKitUrl.startsWith(manualPrefix)) {
      return {
        success: false,
        error: `Manual upload for ${slot} must be inside ${manualPrefix}`,
      };
    }
    if (pick?.type === "url") {
      const validated = validatePasteUrl(pick.sourceUrl);
      if (!validated.ok) {
        return { success: false, error: `Pasted URL for ${slot}: ${validated.error}` };
      }
    }
  }

  // Snapshot existing slot URLs so we can compute which slots are being
  // dropped (orphan cleanup, issue #169). Done in parallel with the uploads
  // since neither depends on the other.
  const admin = createAdminClient();
  const existingRowPromise = admin
    .from("games")
    .select(
      "steamgriddb_icon_url, steamgriddb_logo_url, steamgriddb_hero_url, steamgriddb_grid_url",
    )
    .eq("id", gameId)
    .maybeSingle();

  const slotUrls: Partial<Record<AssetSlot, string>> = {};
  let existingRow: Record<string, string | null> | null = null;
  try {
    const [existingResult] = await Promise.all([
      existingRowPromise,
      Promise.all(
        ALL_SLOTS.map(async (slot) => {
          const pick = picks[slot];
          if (!pick || pick.type === "skip") return;
          if (pick.type === "steamgriddb" || pick.type === "url") {
            // Both flows hand a remote URL to ImageKit's URL-import. The URL
            // type is admin-pasted; the steamgriddb type comes from the SGDB
            // API. Same upload path either way.
            const { url } = await uploadFromUrl({
              gameId,
              slot,
              sourceUrl: pick.sourceUrl,
            });
            slotUrls[slot] = withCacheBuster(url);
          } else {
            slotUrls[slot] = withCacheBuster(pick.imageKitUrl);
          }
        }),
      ),
    ]);
    existingRow = (existingResult.data as Record<string, string | null> | null) ?? null;
  } catch (err) {
    return {
      success: false,
      error: `ImageKit upload failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  const updatePayload: Record<string, unknown> = {
    steamgriddb_game_id: steamGridDbGameId,
    assets_enriched: true,
    curated_at: new Date().toISOString(),
    curated_by: session.user.id,
  };
  for (const slot of ALL_SLOTS) {
    updatePayload[SLOT_COLUMN[slot]] = slotUrls[slot] ?? null;
  }

  const { error } = await admin.from("games").update(updatePayload).eq("id", gameId);
  if (error) return { success: false, error: error.message };

  // Orphan cleanup runs AFTER the DB write commits — that way if the DB write
  // fails, the old files are still in ImageKit and the DB still references
  // them (no broken-image link). Cleanup is best-effort; failures don't undo
  // the save.
  const orphanFileNames: string[] = [];
  for (const slot of ALL_SLOTS) {
    const orphan = computeSlotOrphan(
      existingRow?.[SLOT_COLUMN[slot]],
      slotUrls[slot],
    );
    if (orphan) orphanFileNames.push(orphan);
  }
  if (orphanFileNames.length > 0) {
    await deleteFilesByName(gameId, orphanFileNames);
  }

  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);
  return { success: true };
}

// Per-slot edit (issue #176). Updates exactly one slot's URL + curated_at /
// curated_by. Leaves the other 3 slot columns and steamgriddb_game_id alone.
// Sets assets_enriched=true if at least one slot ends up populated; otherwise
// leaves it as the row's current value (use clearCuration to wipe everything).
export async function updateSingleSlot(
  input: UpdateSingleSlotInput,
): Promise<{ success: boolean; error?: string }> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Auth failed" };
  }

  const { gameId, slot, pick } = input;

  let manualPrefix: string;
  try {
    manualPrefix = expectedManualPrefix(gameId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Config missing" };
  }

  if (pick.type === "manual" && !pick.imageKitUrl.startsWith(manualPrefix)) {
    return {
      success: false,
      error: `Manual upload for ${slot} must be inside ${manualPrefix}`,
    };
  }
  if (pick.type === "url") {
    const validated = validatePasteUrl(pick.sourceUrl);
    if (!validated.ok) {
      return { success: false, error: `Pasted URL: ${validated.error}` };
    }
  }

  // Snapshot all slot URLs so we can (a) cleanly compute the orphan for the
  // edited slot and (b) recompute assets_enriched from the post-write state.
  const admin = createAdminClient();
  const existingRowPromise = admin
    .from("games")
    .select(
      "steamgriddb_icon_url, steamgriddb_logo_url, steamgriddb_hero_url, steamgriddb_grid_url",
    )
    .eq("id", gameId)
    .maybeSingle();

  let newUrl: string | undefined;
  let existingRow: Record<string, string | null> | null = null;
  try {
    if (pick.type === "steamgriddb" || pick.type === "url") {
      // Same upload path: hand the remote URL to ImageKit's URL-import.
      const [existingResult, uploaded] = await Promise.all([
        existingRowPromise,
        uploadFromUrl({ gameId, slot, sourceUrl: pick.sourceUrl }),
      ]);
      existingRow = (existingResult.data as Record<string, string | null> | null) ?? null;
      newUrl = withCacheBuster(uploaded.url);
    } else if (pick.type === "manual") {
      const existingResult = await existingRowPromise;
      existingRow = (existingResult.data as Record<string, string | null> | null) ?? null;
      newUrl = withCacheBuster(pick.imageKitUrl);
    } else {
      // skip = clear this slot
      const existingResult = await existingRowPromise;
      existingRow = (existingResult.data as Record<string, string | null> | null) ?? null;
      newUrl = undefined;
    }
  } catch (err) {
    return {
      success: false,
      error: `ImageKit upload failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  // Recompute assets_enriched from the resulting state (this slot's new value
  // + the other three slots' existing values). If at least one slot ends up
  // populated, the row is still considered enriched.
  const willHaveAny = ALL_SLOTS.some((s) =>
    s === slot ? !!newUrl : !!existingRow?.[SLOT_COLUMN[s]],
  );

  const updatePayload: Record<string, unknown> = {
    [SLOT_COLUMN[slot]]: newUrl ?? null,
    assets_enriched: willHaveAny,
    curated_at: new Date().toISOString(),
    curated_by: session.user.id,
  };

  const { error } = await admin.from("games").update(updatePayload).eq("id", gameId);
  if (error) return { success: false, error: error.message };

  const orphan = computeSlotOrphan(existingRow?.[SLOT_COLUMN[slot]], newUrl);
  if (orphan) {
    await deleteFilesByName(gameId, [orphan]);
  }

  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);
  return { success: true };
}

export async function clearCuration(
  gameId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSession();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Auth failed" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("games")
    .update({
      steamgriddb_game_id: null,
      steamgriddb_icon_url: null,
      steamgriddb_logo_url: null,
      steamgriddb_hero_url: null,
      steamgriddb_grid_url: null,
      assets_enriched: false,
      curated_at: null,
      curated_by: null,
    })
    .eq("id", gameId);
  if (error) return { success: false, error: error.message };

  // Best-effort. DB cleanup is the source of truth; ImageKit orphans are recoverable.
  await deleteGameFolder(gameId);

  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);
  return { success: true };
}
