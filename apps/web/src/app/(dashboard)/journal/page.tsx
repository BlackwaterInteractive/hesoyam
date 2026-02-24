import { createClient } from '@/lib/supabase/server'
import { CalendarHeatmap } from '@/components/journal/calendar-heatmap'

export const metadata = {
  title: 'Journal - Hesoyam',
  description: 'Your gaming journal and calendar',
}

export default async function JournalPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59`

  const { data: sessions } = await supabase
    .from('game_sessions')
    .select(
      `
      id, game_id, started_at, ended_at, duration_secs, active_secs, idle_secs, game_name,
      games (id, name, cover_url, genres, slug)
    `
    )
    .eq('user_id', user.id)
    .gte('started_at', monthStart)
    .lte('started_at', monthEnd)
    .order('started_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Journal</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Your gaming activity calendar
        </p>
      </div>

      <CalendarHeatmap
        userId={user.id}
        initialSessions={(sessions as any[]) ?? []}
        initialYear={year}
        initialMonth={month}
      />
    </div>
  )
}
