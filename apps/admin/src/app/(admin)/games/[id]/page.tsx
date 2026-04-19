import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { GameDetail } from "@/components/games/game-detail";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Fetch game
  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single();

  if (!game) {
    notFound();
  }

  // Fetch stats, recent sessions, and top players in parallel
  const [sessionsStatsResult, recentSessionsResult, topPlayersResult] =
    await Promise.all([
      // Session count + unique player count
      supabase
        .from("game_sessions")
        .select("user_id")
        .eq("game_id", id),

      // Recent 20 sessions with user info
      supabase
        .from("game_sessions")
        .select(
          "id, user_id, started_at, ended_at, duration_secs, source, profiles(username, display_name, avatar_url)"
        )
        .eq("game_id", id)
        .order("started_at", { ascending: false })
        .limit(20),

      // Top 10 players by total time
      supabase
        .from("user_games")
        .select(
          "user_id, total_time_secs, total_sessions, profiles:user_id(username, display_name, avatar_url)"
        )
        .eq("game_id", id)
        .order("total_time_secs", { ascending: false })
        .limit(10),
    ]);

  // Compute session/player stats
  const allSessions = sessionsStatsResult.data ?? [];
  const sessionCount = allSessions.length;
  const uniquePlayers = new Set(allSessions.map((s) => s.user_id));
  const playerCount = uniquePlayers.size;

  // Map recent sessions
  const recentSessions = (recentSessionsResult.data ?? []).map((s: any) => ({
    id: s.id,
    user_id: s.user_id,
    username: s.profiles?.display_name ?? s.profiles?.username ?? "Unknown",
    avatar_url: s.profiles?.avatar_url ?? null,
    started_at: s.started_at,
    ended_at: s.ended_at,
    duration_secs: s.duration_secs,
    source: s.source as "agent" | "discord",
  }));

  // Map top players
  const topPlayers = (topPlayersResult.data ?? []).map((p: any) => ({
    user_id: p.user_id,
    username: p.profiles?.display_name ?? p.profiles?.username ?? "Unknown",
    avatar_url: p.profiles?.avatar_url ?? null,
    total_time_secs: p.total_time_secs,
    total_sessions: p.total_sessions,
  }));

  // Compute average duration
  const totalDuration = recentSessions.reduce(
    (sum: number, s: any) => sum + (s.duration_secs ?? 0),
    0
  );
  const avgDuration =
    recentSessions.length > 0
      ? Math.round(totalDuration / recentSessions.length)
      : 0;

  return (
    <GameDetail
      game={game}
      stats={{ session_count: sessionCount, player_count: playerCount, avg_duration: avgDuration }}
      recentSessions={recentSessions}
      topPlayers={topPlayers}
    />
  );
}
