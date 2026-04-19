import { createAdminClient } from "@/lib/supabase/admin";
import { ActiveSessionsTable } from "@/components/sessions/active-sessions-table";

export default async function SessionsPage() {
  const supabase = createAdminClient();

  const { data: sessions } = await supabase
    .from("game_sessions")
    .select(
      "id, user_id, game_id, game_name, started_at, source, profiles(username, display_name, avatar_url), games(name, cover_url)"
    )
    .is("ended_at", null)
    .order("started_at", { ascending: true });

  const mapped = (sessions ?? []).map((s: any) => ({
    id: s.id,
    user_id: s.user_id,
    game_id: s.game_id,
    game_name: s.games?.name ?? s.game_name ?? "Unknown",
    game_cover_url: s.games?.cover_url ?? null,
    username: s.profiles?.display_name ?? s.profiles?.username ?? "Unknown",
    avatar_url: s.profiles?.avatar_url ?? null,
    started_at: s.started_at,
    source: s.source as "agent" | "discord",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Active Sessions</h1>
        <p className="text-muted-foreground mt-1">
          {mapped.length === 0
            ? "No one is playing right now"
            : `${mapped.length} live session${mapped.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      <ActiveSessionsTable sessions={mapped} />
    </div>
  );
}
