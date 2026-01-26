import { createClient } from '@/lib/supabase/server'
import { CalendarHeatmap } from '@/components/journal/calendar-heatmap'
import { DaySessions } from '@/components/journal/day-sessions'

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

  const { data: calendarData } = await supabase.rpc('get_calendar_data', {
    p_user_id: user.id,
    p_year: year,
    p_month: month,
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Journal</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Track your daily gaming activity
        </p>
      </div>

      {/* Calendar heatmap */}
      <CalendarHeatmap
        userId={user.id}
        initialData={(calendarData as any[]) ?? []}
        initialYear={year}
        initialMonth={month}
      />

      {/* Day sessions panel */}
      <DaySessions userId={user.id} />
    </div>
  )
}
