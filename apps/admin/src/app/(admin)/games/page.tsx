import { createAdminClient } from "@/lib/supabase/admin";
import { GamesTable } from "@/components/games/games-table";

const PAGE_SIZE = 25;

type SortMode = "recent" | "plays_desc";

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    filter?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const filter = params.filter ?? "all";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10));

  // PRD §10: when "Needs Enrichment" filter is active, default sort to
  // plays_desc so the most-played unenriched games surface first. Explicit
  // sort param wins.
  const sort: SortMode =
    params.sort === "plays_desc"
      ? "plays_desc"
      : params.sort === "recent"
        ? "recent"
        : filter === "needs_enrichment"
          ? "plays_desc"
          : "recent";

  const offset = (currentPage - 1) * PAGE_SIZE;

  const supabase = createAdminClient();

  function applyFilters<T extends { ilike: Function; is: Function; or: Function; eq: Function }>(
    query: T,
  ): T {
    let q: any = query;
    if (search) q = q.ilike("name", `%${search}%`);
    switch (filter) {
      case "missing_cover":
        q = q.is("cover_url", null);
        break;
      case "missing_genres":
        q = q.or("genres.is.null,genres.eq.{}");
        break;
      case "ignored":
        q = q.eq("ignored", true);
        break;
      case "needs_enrichment":
        q = q.eq("assets_enriched", false);
        break;
      case "all":
      default:
        break;
    }
    return q as T;
  }

  // Count of matching games (for pagination footer)
  let countQuery = supabase
    .from("games")
    .select("*", { count: "exact", head: true });
  countQuery = applyFilters(countQuery as any);

  let games: any[] = [];
  let totalCount = 0;

  if (sort === "plays_desc") {
    // Sort by session count: pre-aggregate sessions, then fetch matching
    // games and sort/paginate in JS. Acceptable for current data scale (~5k
    // games, ~tens of thousands of sessions). If this gets slow, swap for an
    // RPC that returns games + session_count + player_count in one shot.
    const [{ count }, { data: allSessions }] = await Promise.all([
      countQuery,
      supabase.from("game_sessions").select("game_id, user_id"),
    ]);
    totalCount = count ?? 0;

    let allMatchingQuery = supabase.from("games").select("*");
    allMatchingQuery = applyFilters(allMatchingQuery as any);
    const { data: allMatching } = await allMatchingQuery;
    const matchingGames = allMatching ?? [];

    const sessionStats: Record<string, { sessions: number; players: Set<string> }> = {};
    for (const s of allSessions ?? []) {
      if (!s.game_id) continue;
      if (!sessionStats[s.game_id]) sessionStats[s.game_id] = { sessions: 0, players: new Set() };
      sessionStats[s.game_id].sessions++;
      sessionStats[s.game_id].players.add(s.user_id);
    }

    const ranked = matchingGames
      .map((g) => ({
        ...g,
        session_count: sessionStats[g.id]?.sessions ?? 0,
        player_count: sessionStats[g.id]?.players.size ?? 0,
      }))
      .sort((a, b) => b.session_count - a.session_count);

    games = ranked.slice(offset, offset + PAGE_SIZE);
  } else {
    // Default: most recently created first, with per-page session count lookup.
    let gamesQuery = supabase
      .from("games")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    gamesQuery = applyFilters(gamesQuery as any);

    const [countResult, gamesResult] = await Promise.all([countQuery, gamesQuery]);
    totalCount = countResult.count ?? 0;
    const pageGames = gamesResult.data ?? [];

    let statsMap: Record<string, { session_count: number; player_count: number }> = {};
    const gameIds = pageGames.map((g) => g.id);
    if (gameIds.length > 0) {
      const { data: sessions } = await supabase
        .from("game_sessions")
        .select("game_id, user_id")
        .in("game_id", gameIds);
      const acc: Record<string, { sessions: number; players: Set<string> }> = {};
      for (const s of sessions ?? []) {
        if (!s.game_id) continue;
        if (!acc[s.game_id]) acc[s.game_id] = { sessions: 0, players: new Set() };
        acc[s.game_id].sessions++;
        acc[s.game_id].players.add(s.user_id);
      }
      for (const [gameId, stat] of Object.entries(acc)) {
        statsMap[gameId] = { session_count: stat.sessions, player_count: stat.players.size };
      }
    }

    games = pageGames.map((g) => ({
      ...g,
      session_count: statsMap[g.id]?.session_count ?? 0,
      player_count: statsMap[g.id]?.player_count ?? 0,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Games</h1>
        <p className="text-muted-foreground mt-1">
          Browse, edit, and manage game metadata
        </p>
      </div>

      <GamesTable
        games={games}
        totalCount={totalCount}
        currentPage={currentPage}
        search={search}
        filter={filter}
        sort={sort}
      />
    </div>
  );
}
