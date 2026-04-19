import { createAdminClient } from "@/lib/supabase/admin";
import { GamesTable } from "@/components/games/games-table";

const PAGE_SIZE = 25;

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const filter = params.filter ?? "all";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const supabase = createAdminClient();

  // Build base query with filters
  function applyFilters(query: any) {
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    switch (filter) {
      case "missing_cover":
        query = query.is("cover_url", null);
        break;
      case "missing_genres":
        query = query.or("genres.is.null,genres.eq.{}");
        break;
      case "ignored":
        query = query.eq("ignored", true);
        break;
      case "all":
      default:
        // Show everything including ignored
        break;
    }

    return query;
  }

  // Count
  let countQuery = supabase
    .from("games")
    .select("*", { count: "exact", head: true });
  countQuery = applyFilters(countQuery);

  // Fetch games
  let gamesQuery = supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  gamesQuery = applyFilters(gamesQuery);

  const [countResult, gamesResult] = await Promise.all([
    countQuery,
    gamesQuery,
  ]);

  const totalCount = countResult.count ?? 0;
  const games = gamesResult.data ?? [];

  // Fetch session counts and unique player counts for these games
  const gameIds = games.map((g) => g.id);
  let statsMap: Record<string, { session_count: number; player_count: number }> = {};

  if (gameIds.length > 0) {
    const { data: sessions } = await supabase
      .from("game_sessions")
      .select("game_id, user_id")
      .in("game_id", gameIds);

    if (sessions) {
      const gameStats: Record<
        string,
        { sessions: number; players: Set<string> }
      > = {};
      for (const s of sessions) {
        if (!s.game_id) continue;
        if (!gameStats[s.game_id]) {
          gameStats[s.game_id] = { sessions: 0, players: new Set() };
        }
        gameStats[s.game_id].sessions++;
        gameStats[s.game_id].players.add(s.user_id);
      }
      for (const [gameId, stat] of Object.entries(gameStats)) {
        statsMap[gameId] = {
          session_count: stat.sessions,
          player_count: stat.players.size,
        };
      }
    }
  }

  const gamesWithStats = games.map((g) => ({
    ...g,
    session_count: statsMap[g.id]?.session_count ?? 0,
    player_count: statsMap[g.id]?.player_count ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Games</h1>
        <p className="text-muted-foreground mt-1">
          Browse, edit, and manage game metadata
        </p>
      </div>

      <GamesTable
        games={gamesWithStats}
        totalCount={totalCount}
        currentPage={currentPage}
        search={search}
        filter={filter}
      />
    </div>
  );
}
