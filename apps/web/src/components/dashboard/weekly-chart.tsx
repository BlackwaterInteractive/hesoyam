'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { format, subDays } from 'date-fns'

interface DailyData {
  date: string
  total_secs: number
}

interface WeeklyChartProps {
  data: DailyData[]
}

function buildChartData(data: DailyData[]) {
  const dataMap = new Map<string, number>()
  for (const d of data) {
    dataMap.set(d.date, d.total_secs)
  }

  const days = []
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayLabel = format(date, 'EEE')
    const secs = dataMap.get(dateStr) || 0
    days.push({
      day: dayLabel,
      hours: Math.round((secs / 3600) * 10) / 10,
      secs,
    })
  }

  return days
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: { secs: number } }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  const secs = payload[0].payload.secs
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)

  return (
    <div className="border border-zinc-700 bg-zinc-800 px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p className="text-sm font-bold text-white">
        {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
      </p>
    </div>
  )
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  const chartData = buildChartData(data ?? [])
  const maxHours = Math.max(...chartData.map((d) => d.hours), 1)

  return (
    <div className="border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-white">Weekly Activity</h2>
      <p className="mt-1 text-sm text-zinc-500">Hours played per day</p>

      <div className="mt-6 h-56">
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
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 12 }}
              domain={[0, Math.ceil(maxHours)]}
              tickFormatter={(v: number) => `${v}h`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar
              dataKey="hours"
              fill="#10b981"
              radius={[0, 0, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
