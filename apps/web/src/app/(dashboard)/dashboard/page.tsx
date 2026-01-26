import { createClient } from '@/lib/supabase/server'
import { OverviewCards } from '@/components/dashboard/overview-cards'
import { LiveSessionCard } from '@/components/dashboard/live-session-card'
import { RecentSessions } from '@/components/dashboard/recent-sessions'
import { WeeklyChart } from '@/components/dashboard/weekly-chart'

interface DashboardOverview {
  today_secs: number
  today_games: number
  today_sessions: number
  week_secs: number
  week_games: number
  week_sessions: number
  month_secs: number
  month_games: number
  month_sessions: number
  daily_breakdown: Array<{ date: string; total_secs: number }>
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

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

  const stats = (overview as DashboardOverview | null) ?? {
    today_secs: 0,
    today_games: 0,
    today_sessions: 0,
    week_secs: 0,
    week_games: 0,
    week_sessions: 0,
    month_secs: 0,
    month_games: 0,
    month_sessions: 0,
    daily_breakdown: [],
  }

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
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', session.game_id)
      .single()

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
          total_secs: stats.today_secs,
          game_count: stats.today_games,
          session_count: stats.today_sessions,
        }}
        week={{
          total_secs: stats.week_secs,
          game_count: stats.week_games,
          session_count: stats.week_sessions,
        }}
        month={{
          total_secs: stats.month_secs,
          game_count: stats.month_games,
          session_count: stats.month_sessions,
        }}
      />

      {/* Charts and recent sessions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WeeklyChart data={stats.daily_breakdown} />
        <RecentSessions sessions={(recentSessions as any) ?? []} />
      </div>
    </div>
  )
}
