import { createAdminClient } from "@/lib/supabase/admin";
import { KpiCards, type PlatformOverview } from "@/components/overview/kpi-cards";
import { RecentSignups } from "@/components/overview/recent-signups";
import { ActiveSessions } from "@/components/overview/active-sessions";

export default async function OverviewPage() {
  const supabase = createAdminClient();

  const [overviewResult, signupsResult, sessionsResult] = await Promise.all([
    supabase.rpc("get_admin_platform_overview"),
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, discord_id, created_at, role")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("game_sessions")
      .select("id, user_id, game_name, started_at, profiles(username, avatar_url), games(name, cover_url)")
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  const overview = (overviewResult.data as PlatformOverview | null) ?? {
    total_users: 0,
    dau: 0,
    wau: 0,
    mau: 0,
    active_sessions: 0,
    sessions_today: 0,
    total_games: 0,
    total_sessions: 0,
    total_playtime_secs: 0,
    signups_today: 0,
    signups_this_week: 0,
    discord_connected: 0,
    in_guild_count: 0,
  };

  const signups = signupsResult.data ?? [];

  const sessions = (sessionsResult.data ?? []).map((s: any) => ({
    id: s.id,
    user_id: s.user_id,
    game_name: s.game_name ?? s.games?.name ?? "Unknown",
    started_at: s.started_at,
    username: s.profiles?.username ?? undefined,
    avatar_url: s.profiles?.avatar_url ?? undefined,
    game_cover_url: s.games?.cover_url ?? undefined,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">
          Platform health at a glance
        </p>
      </div>

      <KpiCards data={overview} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentSignups signups={signups} />
        <ActiveSessions sessions={sessions} />
      </div>
    </div>
  );
}
