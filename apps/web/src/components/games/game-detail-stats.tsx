'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { format, subDays, isSameDay, parseISO } from 'date-fns'
import { formatDuration } from '@/lib/utils'
import type { Game, UserGame, GameSession } from '@/lib/types'

interface StatCardProps {
  label: string
  value: string
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-zinc-100">{value}</p>
    </div>
  )
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 shadow-lg">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-emerald-400">
        {formatDuration(payload[0].value)}
      </p>
    </div>
  )
}

interface GameDetailStatsProps {
  game: Game
  userGame: UserGame
  sessions: GameSession[]
}

export function GameDetailStats({
  game,
  userGame,
  sessions,
}: GameDetailStatsProps) {
  const chartData = useMemo(() => {
    const now = new Date()
    const days: { date: string; label: string; totalSecs: number }[] = []

    for (let i = 29; i >= 0; i--) {
      const day = subDays(now, i)
      days.push({
        date: format(day, 'yyyy-MM-dd'),
        label: format(day, 'MMM d'),
        totalSecs: 0,
      })
    }

    sessions.forEach((session) => {
      const sessionDate = parseISO(session.started_at)
      const entry = days.find((d) =>
        isSameDay(parseISO(d.date), sessionDate)
      )
      if (entry) {
        entry.totalSecs += session.duration_secs
      }
    })

    return days.map((d) => ({
      name: d.label,
      playtime: d.totalSecs,
    }))
  }, [sessions])

  const firstPlayed = format(new Date(userGame.first_played), 'MMM d, yyyy')
  const lastPlayed = format(new Date(userGame.last_played), 'MMM d, yyyy')

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Playtime"
          value={formatDuration(userGame.total_time_secs)}
        />
        <StatCard
          label="Sessions"
          value={String(userGame.total_sessions)}
        />
        <StatCard
          label="Avg Session"
          value={formatDuration(userGame.avg_session_secs)}
        />
        <StatCard label="First Played" value={firstPlayed} />
        <StatCard label="Last Played" value={lastPlayed} />
      </div>

      {/* Play time chart */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="mb-6 text-lg font-semibold text-zinc-100">
          Play Time - Last 30 Days
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#71717a' }}
                tickLine={false}
                axisLine={{ stroke: '#27272a' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => {
                  if (val === 0) return '0'
                  return formatDuration(val)
                }}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
              />
              <Bar
                dataKey="playtime"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
