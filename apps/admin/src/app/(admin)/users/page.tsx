import { createAdminClient } from "@/lib/supabase/admin";
import { UsersTable } from "@/components/users/users-table";

const PAGE_SIZE = 25;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const supabase = createAdminClient();

  // Build the profiles query with optional search filter
  let countQuery = supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  let profilesQuery = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (search) {
    const filter = `username.ilike.%${search}%,email.ilike.%${search}%,discord_id.ilike.%${search}%`;
    countQuery = countQuery.or(filter);
    profilesQuery = profilesQuery.or(filter);
  }

  const [countResult, profilesResult] = await Promise.all([
    countQuery,
    profilesQuery,
  ]);

  const totalCount = countResult.count ?? 0;
  const profiles = profilesResult.data ?? [];

  // Fetch aggregated user_games stats for all returned user IDs
  const userIds = profiles.map((p) => p.id);
  let statsMap: Record<string, { total_playtime: number; session_count: number }> = {};

  if (userIds.length > 0) {
    const { data: userGames } = await supabase
      .from("user_games")
      .select("user_id, total_time_secs, total_sessions")
      .in("user_id", userIds);

    if (userGames) {
      for (const ug of userGames) {
        if (!statsMap[ug.user_id]) {
          statsMap[ug.user_id] = { total_playtime: 0, session_count: 0 };
        }
        statsMap[ug.user_id].total_playtime += ug.total_time_secs;
        statsMap[ug.user_id].session_count += ug.total_sessions;
      }
    }
  }

  const users = profiles.map((p) => ({
    ...p,
    total_playtime: statsMap[p.id]?.total_playtime ?? 0,
    session_count: statsMap[p.id]?.session_count ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-1">
          Manage and inspect all registered users
        </p>
      </div>

      <UsersTable
        users={users}
        totalCount={totalCount}
        currentPage={currentPage}
        search={search}
      />
    </div>
  );
}
