import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  UserProfileCard,
  UserStatsCards,
  UserTopGames,
  UserRecentSessions,
} from "@/components/users/user-detail";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) {
    notFound();
  }

  // Fetch stats, top games, and recent sessions in parallel
  const [userGamesResult, topGamesResult, recentSessionsResult] =
    await Promise.all([
      // Aggregated stats from user_games
      supabase
        .from("user_games")
        .select("total_time_secs, total_sessions, game_id")
        .eq("user_id", id),

      // Top 10 games by playtime
      supabase
        .from("user_games")
        .select("total_time_secs, total_sessions, game_id, games(name, cover_url)")
        .eq("user_id", id)
        .order("total_time_secs", { ascending: false })
        .limit(10),

      // Recent 20 sessions
      supabase
        .from("game_sessions")
        .select("id, started_at, ended_at, duration_secs, source, game_name, games(name, cover_url)")
        .eq("user_id", id)
        .order("started_at", { ascending: false })
        .limit(20),
    ]);

  const userGames = userGamesResult.data ?? [];
  const totalPlaytime = userGames.reduce((sum, ug) => sum + ug.total_time_secs, 0);
  const totalSessions = userGames.reduce((sum, ug) => sum + ug.total_sessions, 0);
  const gamesPlayed = userGames.length;
  const avgSessionLength =
    totalSessions > 0 ? Math.round(totalPlaytime / totalSessions) : 0;

  const stats = {
    totalPlaytime,
    totalSessions,
    gamesPlayed,
    avgSessionLength,
  };

  const topGames = (topGamesResult.data ?? []).map((ug: any) => ({
    game_name: ug.games?.name ?? "Unknown",
    cover_url: ug.games?.cover_url ?? null,
    total_time_secs: ug.total_time_secs,
    total_sessions: ug.total_sessions,
  }));

  const recentSessions = (recentSessionsResult.data ?? []).map((s: any) => ({
    id: s.id,
    game_name: s.games?.name ?? s.game_name ?? "Unknown",
    started_at: s.started_at,
    ended_at: s.ended_at,
    duration_secs: s.duration_secs,
    source: s.source as "agent" | "discord",
  }));

  return (
    <div className="space-y-8">
      <UserProfileCard profile={profile} />
      <UserStatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserTopGames games={topGames} />
        <UserRecentSessions sessions={recentSessions} />
      </div>
    </div>
  );
}
