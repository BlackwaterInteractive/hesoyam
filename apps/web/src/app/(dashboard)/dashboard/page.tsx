import { createClient } from '@/lib/supabase/server'
import { formatDuration } from '@/lib/utils'
import { format, startOfWeek, addDays, isAfter, isToday, isYesterday, startOfDay } from 'date-fns'
import { GameplayCardClient } from '@/components/dashboard/gameplay-card-client'
import { StreakCard } from '@/components/dashboard/streak-card'
import { StatBar } from '@/components/dashboard/stat-bar'
import { MostPlayedCard } from '@/components/dashboard/most-played-card'
import { RecentPlays } from '@/components/dashboard/recent-plays'
import { DevNoteCard } from '@/components/dashboard/dev-note-card'

interface RpcOverview {
  today: { total_secs: number; game_count: number }
  this_week: { total_secs: number; game_count: number }
  this_month: { total_secs: number; game_count: number }
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()

  // Profile (for avatar)
  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url, display_name, username')
    .eq('id', user.id)
    .single()

  // 1. Dashboard overview (today / this week / this month)
  const { data: overview } = await supabase.rpc('get_dashboard_overview', { p_user_id: user.id })
  const rpc = (overview as RpcOverview | null) ?? {
    today: { total_secs: 0, game_count: 0 },
    this_week: { total_secs: 0, game_count: 0 },
    this_month: { total_secs: 0, game_count: 0 },
  }

  // 2. All time total
  const { data: allTimeSessions } = await supabase
    .from('game_sessions')
    .select('duration_secs')
    .eq('user_id', user.id)
    .not('ended_at', 'is', null)
  const allTimeSecs = allTimeSessions?.reduce((sum, s) => sum + s.duration_secs, 0) ?? 0

  // 3. Live session (passed as initial data to client component)
  const { data: liveSessions } = await supabase
    .from('game_sessions')
    .select('*, games(*)')
    .eq('user_id', user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
  const rawLive = liveSessions?.[0] ?? null

  // 4. Last completed session (shown when not playing)
  const { data: lastSessions } = await supabase
    .from('game_sessions')
    .select('*, games(*)')
    .eq('user_id', user.id)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
  const rawLast = lastSessions?.[0] ?? null

  function buildSessionData(raw: any) {
    if (!raw) return null
    const game = raw.games as any
    const gameObj = game ?? (raw.game_name ? {
      id: `discord-${raw.id}`, igdb_id: null, name: raw.game_name,
      slug: raw.game_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      cover_url: null, genres: null, developer: null, release_year: null,
      description: null, publisher: null, platforms: null, screenshots: null,
      artwork_url: null, igdb_url: null, rating: null, rating_count: null,
      first_release_date: null, igdb_updated_at: null, metadata_source: null,
      discord_application_id: null, created_at: raw.created_at,
    } : null)
    if (!gameObj) return null
    const { games: _g, ...session } = raw
    return { session, game: gameObj }
  }

  const initialLiveSession = buildSessionData(rawLive)
  const initialLastSession = buildSessionData(rawLast)

  // 5. Current week breakdown (Sun–Sat)
  const weekStart = startOfWeek(now, { weekStartsOn: 0 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { data: weekSessions } = await supabase
    .from('game_sessions')
    .select('started_at, duration_secs')
    .eq('user_id', user.id)
    .gte('started_at', weekStart.toISOString())
    .not('ended_at', 'is', null)

  const dayMap = new Map<string, number>()
  for (const s of weekSessions ?? []) {
    const dateKey = s.started_at.slice(0, 10)
    dayMap.set(dateKey, (dayMap.get(dateKey) ?? 0) + s.duration_secs)
  }

  const streakDays = weekDays.map((day) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const dayName = format(day, 'EEEE').toUpperCase()
    const dateLabel = format(day, 'MMM d').toUpperCase()
    const isUpcoming = isAfter(startOfDay(day), startOfDay(now))
    const playSecs = dayMap.get(dateKey)

    let status: 'tracked' | 'missed' | 'upcoming'
    if (isUpcoming) status = 'upcoming'
    else if (playSecs) status = 'tracked'
    else status = 'missed'

    return {
      date: dateLabel,
      day: dayName,
      playtime: playSecs ? formatDuration(playSecs) : null,
      status,
    }
  })

  // 6. Week streak (consecutive weeks with at least 1 session)
  const { data: allSessionDates } = await supabase
    .from('game_sessions')
    .select('started_at')
    .eq('user_id', user.id)
    .not('ended_at', 'is', null)

  const activeWeeks = new Set<string>()
  for (const s of allSessionDates ?? []) {
    const sunday = startOfWeek(new Date(s.started_at), { weekStartsOn: 0 })
    activeWeeks.add(format(sunday, 'yyyy-MM-dd'))
  }

  let weekStreak = 0
  let checkWeek = startOfWeek(now, { weekStartsOn: 0 })
  // If current week has no sessions, start checking from last week
  if (!activeWeeks.has(format(checkWeek, 'yyyy-MM-dd'))) {
    checkWeek = addDays(checkWeek, -7)
  }
  while (activeWeeks.has(format(checkWeek, 'yyyy-MM-dd'))) {
    weekStreak++
    checkWeek = addDays(checkWeek, -7)
  }

  // 7. Most played game
  const { data: topGame } = await supabase
    .from('user_games')
    .select('total_time_secs, games(*)')
    .eq('user_id', user.id)
    .order('total_time_secs', { ascending: false })
    .limit(1)
    .single()
  const topGameData = topGame?.games as any

  // 8. Recent 4 sessions
  const { data: recentSessions } = await supabase
    .from('game_sessions')
    .select('*, games(*)')
    .eq('user_id', user.id)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(4)

  const recentPlays = (recentSessions ?? []).map((s) => {
    const game = s.games as any
    const d = new Date(s.started_at)
    let playedDate: string
    if (isToday(d)) playedDate = 'Today'
    else if (isYesterday(d)) playedDate = 'Yesterday'
    else playedDate = format(d, 'MMM d')

    return {
      coverUrl: game?.cover_url ?? null,
      gameName: game?.name ?? s.game_name ?? 'Unknown Game',
      developerName: game?.developer ?? game?.publisher ?? '--',
      playtime: formatDuration(s.duration_secs),
      playedDate,
      playedTime: format(d, 'hh:mm a'),
    }
  })

  return (
    <div>
      {/* Row 1: Gameplay + Streak */}
      <div className="flex">
        <GameplayCardClient
          initialSession={initialLiveSession}
          lastSession={initialLastSession}
          userId={user.id}
        />
        <StreakCard
          streakCount={weekStreak}
          streakLabel="Week Streak"
          days={streakDays}
        />
      </div>

      {/* Row 2: Stat Bar */}
      <StatBar
        items={[
          { label: 'Today', value: formatDuration(rpc.today.total_secs) },
          { label: 'This Week', value: formatDuration(rpc.this_week.total_secs) },
          { label: format(now, 'MMMM'), value: formatDuration(rpc.this_month.total_secs) },
          { label: 'All Time', value: formatDuration(allTimeSecs) },
        ]}
      />

      {/* Row 3: Most Played */}
      {topGame && (
        <MostPlayedCard
          label="Most Played"
          gameName={topGameData?.name ?? 'Unknown'}
          playtime={formatDuration(topGame.total_time_secs)}
        />
      )}

      {/* Row 4: Recent Plays + Dev Note */}
      {recentPlays.length > 0 && (
        <div className="flex">
          <RecentPlays items={recentPlays} />
          <DevNoteCard
            title="Note from the dev"
            subtitle="Share feedback, report bugs, see what's new and help support the development of RAID."
            ctaLabel="Support RAID"
          />
        </div>
      )}
    </div>
  )
}
