import { getSupabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { slugify } from '../types/index.js';

interface ResolvedGame {
  id: string;
  name: string;
  slug: string;
  cover_url: string | null;
}

// In-memory cache: game name -> resolved game (avoids repeated DB/API lookups)
const resolveCache = new Map<string, ResolvedGame>();

/**
 * Resolve a game name to a game record in our database.
 * 1. Check in-memory cache
 * 2. Exact match against games table
 * 3. Fuzzy match against games table
 * 4. Search IGDB and import
 * 5. Create minimal record as last resort
 */
export async function resolveGame(gameName: string): Promise<ResolvedGame> {
  // 1. Check cache (normalized key)
  const cacheKey = gameName.toLowerCase().trim();
  const cached = resolveCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const supabase = getSupabase();

  // 2. Exact match first (case-insensitive)
  const { data: exactMatch } = await supabase
    .from('games')
    .select('id, name, slug, cover_url')
    .ilike('name', gameName)
    .limit(1)
    .single();

  if (exactMatch) {
    const resolved = exactMatch as ResolvedGame;
    resolveCache.set(cacheKey, resolved);
    logger.info('Game resolved (exact match)', { gameName, gameId: resolved.id });
    return resolved;
  }

  // 3. Fuzzy match using trigram similarity
  const { data: fuzzyMatches } = await supabase
    .rpc('search_games_fuzzy', { search_term: gameName })
    .limit(1);

  if (fuzzyMatches && fuzzyMatches.length > 0) {
    const match = fuzzyMatches[0] as ResolvedGame;
    resolveCache.set(cacheKey, match);
    logger.info('Game resolved (fuzzy match)', { gameName, matched: match.name, gameId: match.id });
    return match;
  }

  // 4. Search IGDB directly (server has service key, calls IGDB API via Twitch OAuth)
  try {
    const igdbResult = await searchAndImportFromIgdb(gameName);
    if (igdbResult) {
      resolveCache.set(cacheKey, igdbResult);
      logger.info('Game resolved (IGDB import)', { gameName, gameId: igdbResult.id });
      return igdbResult;
    }
  } catch (error) {
    logger.error('IGDB resolution failed', error, { gameName });
  }

  // 5. Last resort: create minimal game record
  const minimal = await createMinimalGame(gameName);
  resolveCache.set(cacheKey, minimal);
  logger.info('Game resolved (minimal record created)', { gameName, gameId: minimal.id });
  return minimal;
}

/**
 * Get a valid IGDB access token (cached in system_config table)
 */
async function getIgdbToken(): Promise<string> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from('system_config')
    .select('value, expires_at')
    .eq('key', 'igdb_token')
    .single();

  if (data && data.expires_at && new Date(data.expires_at) > new Date()) {
    return data.value.access_token;
  }

  // Token missing or expired — the edge functions handle token refresh,
  // so trigger a lightweight search to refresh it
  const projectUrl = env.supabaseUrl;
  const res = await fetch(`${projectUrl}/functions/v1/igdb-search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: 'test', limit: 1 }),
  });
  await res.json();

  // Now fetch the refreshed token
  const { data: refreshed } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'igdb_token')
    .single();

  if (!refreshed) {
    throw new Error('Failed to obtain IGDB token');
  }

  return refreshed.value.access_token;
}

/**
 * Search IGDB and import the best match
 */
async function searchAndImportFromIgdb(gameName: string): Promise<ResolvedGame | null> {
  const supabase = getSupabase();
  const token = await getIgdbToken();

  // Read client ID from the token request (stored alongside)
  // We need the client ID for IGDB calls — get it from env or system_config
  const twitchClientId = process.env.TWITCH_CLIENT_ID;

  if (!twitchClientId) {
    // Fall back to calling edge function via HTTP
    return searchAndImportViaEdgeFunction(gameName);
  }

  const escapedQuery = gameName.replace(/"/g, '\\"');
  // Note: IGDB's `search` + `where category` don't compose correctly (returns empty).
  // Scoring/filtering is handled by the igdb-search edge function instead.
  const apicalypse = [
    'fields name, slug, cover.url, genres.name, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, first_release_date, total_rating, total_rating_count, summary;',
    `search "${escapedQuery}";`,
    'limit 20;',
  ].join('\n');

  const igdbRes = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': twitchClientId,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    body: apicalypse,
  });

  if (!igdbRes.ok) {
    logger.error('IGDB search failed', { status: igdbRes.status }, { gameName });
    return null;
  }

  const results = (await igdbRes.json()) as any[];
  if (!results || results.length === 0) {
    return null;
  }

  // Find best match
  const bestMatch =
    results.find((r: any) => r.name.toLowerCase() === gameName.toLowerCase()) || results[0];

  // Import via edge function (handles DB insert + full metadata fetch)
  return importViaEdgeFunction(bestMatch.id);
}

/**
 * Call igdb-import-game edge function via HTTP
 */
async function importViaEdgeFunction(igdbId: number): Promise<ResolvedGame | null> {
  const projectUrl = env.supabaseUrl;

  const res = await fetch(`${projectUrl}/functions/v1/igdb-import-game`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ igdb_id: igdbId }),
  });

  if (!res.ok) {
    logger.error('igdb-import-game call failed', { status: res.status });
    return null;
  }

  const data: any = await res.json();
  if (!data?.game) return null;

  return {
    id: data.game.id,
    name: data.game.name,
    slug: data.game.slug,
    cover_url: data.game.cover_url,
  };
}

/**
 * Fallback: search + import entirely via edge functions
 */
async function searchAndImportViaEdgeFunction(gameName: string): Promise<ResolvedGame | null> {
  const projectUrl = env.supabaseUrl;

  const searchRes = await fetch(`${projectUrl}/functions/v1/igdb-search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: gameName, limit: 3 }),
  });

  if (!searchRes.ok) return null;

  const searchData: any = await searchRes.json();
  if (!searchData?.results?.length) return null;

  const bestMatch =
    searchData.results.find((r: any) => r.name.toLowerCase() === gameName.toLowerCase()) ||
    searchData.results[0];

  return importViaEdgeFunction(bestMatch.igdb_id);
}

/**
 * Create a minimal game record when no IGDB match is found
 */
async function createMinimalGame(gameName: string): Promise<ResolvedGame> {
  const supabase = getSupabase();
  const slug = slugify(gameName);

  // Check if slug already exists (avoid duplicates)
  const { data: existing } = await supabase
    .from('games')
    .select('id, name, slug, cover_url')
    .eq('slug', slug)
    .single();

  if (existing) {
    return existing as ResolvedGame;
  }

  const { data, error } = await supabase
    .from('games')
    .insert({
      name: gameName,
      slug,
      metadata_source: 'discord',
    })
    .select('id, name, slug, cover_url')
    .single();

  if (error) {
    throw new Error(`Failed to create minimal game: ${error.message}`);
  }

  return data as ResolvedGame;
}

/**
 * Clear the resolve cache (useful for testing or memory management)
 */
export function clearResolveCache(): void {
  resolveCache.clear();
}
