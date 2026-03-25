import { createClient } from '@/lib/supabase/server'
import { GenreChart } from '@/components/stats/genre-chart'
import { PlayPatternHeatmap } from '@/components/stats/play-pattern-heatmap'
import { StreakCards } from '@/components/stats/streak-cards'
import { formatDuration } from '@/lib/utils'

export const metadata = {
  title: 'Stats & Insights - RAID',
  description: 'Your gaming statistics and insights',
}

export default async function StatsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch all data in parallel
  const [genreResult, patternResult, sessionsResult] = await Promise.all([
    supabase.rpc('get_genre_stats', { p_user_id: user.id }),
    supabase.rpc('get_play_patterns', { p_user_id: user.id }),
    supabase
      .from('game_sessions')
      .select('started_at, duration_secs')
      .eq('user_id', user.id)
      .order('started_at', { ascending: true }),
  ])

  const genreData = (genreResult.data as any[]) ?? []
  const patternData = (patternResult.data as any[]) ?? []

  // Build day-level summary for streak calculations
  const sessionsRaw = sessionsResult.data ?? []
  const dayMap = new Map<string, number>()
  sessionsRaw.forEach((s) => {
    const dateStr = s.started_at.slice(0, 10)
    dayMap.set(dateStr, (dayMap.get(dateStr) ?? 0) + s.duration_secs)
  })
  const allDaysPlayed = Array.from(dayMap.entries()).map(
    ([date, total_secs]) => ({ date, total_secs })
  )

  // Compute summary stats
  const totalTimeSecs = sessionsRaw.reduce(
    (sum, s) => sum + s.duration_secs,
    0
  )
  const totalSessions = sessionsRaw.length

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Stats & Insights</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Understand your gaming habits
        </p>
      </div>

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm font-medium text-zinc-400">Total Play Time</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {formatDuration(totalTimeSecs)}
          </p>
        </div>
        <div className="border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm font-medium text-zinc-400">Total Sessions</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {totalSessions.toLocaleString()}
          </p>
        </div>
        <div className="border border-zinc-800 bg-zinc-900 p-6 sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-medium text-zinc-400">Genres Played</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {genreData.length}
          </p>
        </div>
      </div>

      {/* Streak cards */}
      <StreakCards allDaysPlayed={allDaysPlayed} />

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GenreChart data={genreData} />
        <div className="lg:col-span-2">
          <PlayPatternHeatmap data={patternData} />
        </div>
      </div>
    </div>
  )
}
