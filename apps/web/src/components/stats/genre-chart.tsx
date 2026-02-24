'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { formatDuration } from '@/lib/utils'

interface GenreStat {
  genre: string
  total_secs: number
}

interface GenreChartProps {
  data: GenreStat[]
}

const COLORS = [
  '#10b981', // emerald-500
  '#34d399', // emerald-400
  '#6ee7b7', // emerald-300
  '#059669', // emerald-600
  '#047857', // emerald-700
  '#14b8a6', // teal-500
  '#2dd4bf', // teal-400
  '#0d9488', // teal-600
  '#22d3ee', // cyan-400
  '#06b6d4', // cyan-500
]

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null

  const entry = payload[0]
  return (
    <div className="border border-zinc-700 bg-zinc-800 px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-zinc-400">{entry.name}</p>
      <p className="text-sm font-bold text-white">
        {formatDuration(entry.value)}
      </p>
    </div>
  )
}

function CustomLegend({ payload }: any) {
  if (!payload) return null

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 "
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-zinc-400">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function GenreChart({ data }: GenreChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white">
          Genre Distribution
        </h2>
        <p className="mt-1 text-sm text-zinc-500">Time played per genre</p>
        <p className="py-12 text-center text-sm text-zinc-500">
          No genre data available yet
        </p>
      </div>
    )
  }

  const totalSecs = data.reduce((sum, d) => sum + d.total_secs, 0)

  const chartData = data.map((d) => ({
    name: d.genre,
    value: d.total_secs,
    percent: ((d.total_secs / totalSecs) * 100).toFixed(1),
  }))

  return (
    <div className="border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-white">Genre Distribution</h2>
      <p className="mt-1 text-sm text-zinc-500">Time played per genre</p>

      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown list */}
      <div className="mt-4 space-y-2">
        {chartData.map((item, index) => (
          <div
            key={item.name}
            className="flex items-center justify-between px-3 py-2 transition-colors hover:bg-zinc-800"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-sm text-white">{item.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">
                {formatDuration(item.value)}
              </span>
              <span className="w-12 text-right text-xs text-zinc-500">
                {item.percent}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
