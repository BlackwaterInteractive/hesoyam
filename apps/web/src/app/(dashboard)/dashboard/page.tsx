import { createClient } from '@/lib/supabase/server'
import { OverviewCards } from '@/components/dashboard/overview-cards'
import { LiveSessionCard } from '@/components/dashboard/live-session-card'
import { RecentSessions } from '@/components/dashboard/recent-sessions'
import { WeeklyChart } from '@/components/dashboard/weekly-chart'

interface RpcOverview {
  today: { total_secs: number; game_count: number }
  this_week: { total_secs: number; game_count: number }
  this_month: { total_secs: number; game_count: number }
  live_session: unknown
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Clean up any stale sessions (no update for 6+ minutes)
  // This runs on dashboard load to ensure fresh data
  try {
    await supabase.rpc('close_stale_sessions')
  } catch {
    // Ignore errors - cleanup is best-effort
  }

  // Fetch profile for welcome message
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .single()

  // Fetch dashboard overview via RPC
  const { data: overview } = await supabase.rpc('get_dashboard_overview', {
    p_user_id: user.id,
  })

  const rpc = (overview as RpcOverview | null) ?? {
    today: { total_secs: 0, game_count: 0 },
    this_week: { total_secs: 0, game_count: 0 },
    this_month: { total_secs: 0, game_count: 0 },
    live_session: null,
  }

  // Fetch daily breakdown for the last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const { data: dailySessions } = await supabase
    .from('game_sessions')
    .select('started_at, duration_secs')
    .eq('user_id', user.id)
    .gte('started_at', sevenDaysAgo.toISOString())

  const dayMap = new Map<string, number>()
  for (const s of dailySessions ?? []) {
    const date = s.started_at.slice(0, 10)
    dayMap.set(date, (dayMap.get(date) ?? 0) + s.duration_secs)
  }
  const dailyBreakdown = Array.from(dayMap.entries()).map(([date, total_secs]) => ({
    date,
    total_secs,
  }))

  // Fetch live session (ended_at IS NULL)
  const { data: liveSessions } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('user_id', user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)

  let liveSessionData = null
  if (liveSessions && liveSessions.length > 0) {
    const session = liveSessions[0]

    // Try to fetch game if game_id exists (agent sessions)
    let game = null
    if (session.game_id) {
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('id', session.game_id)
        .single()
      game = data
    }

    // For Discord sessions without game_id, create a minimal game object
    if (!game && session.game_name) {
      game = {
        id: `discord-${session.id}`,
        igdb_id: null,
        name: session.game_name,
        slug: session.game_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        cover_url: null,
        genres: null,
        developer: null,
        release_year: null,
        description: null,
        publisher: null,
        platforms: null,
        screenshots: null,
        artwork_url: null,
        igdb_url: null,
        rating: null,
        rating_count: null,
        first_release_date: null,
        igdb_updated_at: null,
        metadata_source: null,
        created_at: session.created_at,
      }
    }

    if (game) {
      liveSessionData = { session, game }
    }
  }

  // Fetch recent completed sessions
  const { data: recentSessions } = await supabase
    .from('game_sessions')
    .select('*, games(id, name, cover_url)')
    .eq('user_id', user.id)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(8)

  const displayName = profile?.display_name || profile?.username || 'Player'

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-white">
          Welcome back, {displayName}
        </h2>
        <p className="mt-1 text-zinc-500">
          Here&apos;s your gaming activity overview.
        </p>
      </div>

      {/* Live session */}
      <LiveSessionCard initialSession={liveSessionData} userId={user.id} />

      {/* Stat cards */}
      <OverviewCards
        today={{
          total_secs: rpc.today.total_secs,
          game_count: rpc.today.game_count,
        }}
        week={{
          total_secs: rpc.this_week.total_secs,
          game_count: rpc.this_week.game_count,
        }}
        month={{
          total_secs: rpc.this_month.total_secs,
          game_count: rpc.this_month.game_count,
        }}
      />

      {/* Charts and recent sessions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WeeklyChart data={dailyBreakdown} />
        <RecentSessions sessions={(recentSessions as any) ?? []} />
      </div>
    </div>
  )
}
