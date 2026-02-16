'use client'

import { formatDuration } from '@/lib/utils'

interface PeriodStats {
  total_secs: number
  game_count: number
  session_count?: number
}

interface OverviewCardsProps {
  today: PeriodStats
  week: PeriodStats
  month: PeriodStats
}

function StatCard({
  label,
  totalSecs,
  gameCount,
  sessionCount,
}: {
  label: string
  totalSecs: number
  gameCount: number
  sessionCount?: number
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">
        {formatDuration(totalSecs)}
      </p>
      <div className="mt-3 flex items-center gap-4 text-sm text-zinc-500">
        <span>
          {gameCount} {gameCount === 1 ? 'game' : 'games'}
        </span>
        {sessionCount != null && (
          <>
            <span className="h-1 w-1 bg-zinc-700" />
            <span>
              {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export function OverviewCards({ today, week, month }: OverviewCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label="Today"
        totalSecs={today.total_secs}
        gameCount={today.game_count}
        sessionCount={today.session_count}
      />
      <StatCard
        label="This Week"
        totalSecs={week.total_secs}
        gameCount={week.game_count}
        sessionCount={week.session_count}
      />
      <StatCard
        label="This Month"
        totalSecs={month.total_secs}
        gameCount={month.game_count}
        sessionCount={month.session_count}
      />
    </div>
  )
}
