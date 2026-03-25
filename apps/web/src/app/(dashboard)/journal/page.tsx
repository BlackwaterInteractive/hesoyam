import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/calendar/calendar-view'

export const metadata = {
  title: 'Journal - RAID',
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

  const [{ data: sessions }, { data: userGames }] = await Promise.all([
    supabase
      .from('game_sessions')
      .select(
        `id, game_id, game_name, started_at, ended_at, duration_secs,
         games (id, name, cover_url, developer, publisher, slug)`
      )
      .eq('user_id', user.id)
      .gte('started_at', monthStart)
      .lte('started_at', monthEnd)
      .order('started_at', { ascending: true }),
    supabase
      .from('user_games')
      .select('game_id, total_time_secs')
      .eq('user_id', user.id),
  ])

  return (
    <CalendarView
      userId={user.id}
      initialSessions={(sessions as any[]) ?? []}
      initialUserGames={(userGames as any[]) ?? []}
      initialYear={year}
      initialMonth={month}
    />
  )
}
