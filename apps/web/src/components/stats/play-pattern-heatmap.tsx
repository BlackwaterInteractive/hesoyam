'use client'

import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/utils'

interface PlayPattern {
  day_of_week: number // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  hour_of_day: number // 0-23
  total_secs: number
  session_count: number
}

interface PlayPatternHeatmapProps {
  data: PlayPattern[]
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Map day_of_week (0=Sun) to row index (0=Mon)
function dayToRowIndex(dayOfWeek: number): number {
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1
}

function getHourLabel(hour: number): string {
  if (hour === 0) return '12a'
  if (hour < 12) return `${hour}a`
  if (hour === 12) return '12p'
  return `${hour - 12}p`
}

function getIntensityClass(totalSecs: number, maxSecs: number): string {
  if (totalSecs === 0) return 'bg-zinc-800'
  const ratio = totalSecs / maxSecs
  if (ratio < 0.25) return 'bg-emerald-900'
  if (ratio < 0.5) return 'bg-emerald-700'
  if (ratio < 0.75) return 'bg-emerald-500'
  return 'bg-emerald-400'
}

export function PlayPatternHeatmap({ data }: PlayPatternHeatmapProps) {
  // Build a 7x24 grid lookup
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  )
  const sessionGrid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  )

  let maxSecs = 1
  data.forEach((p) => {
    const row = dayToRowIndex(p.day_of_week)
    grid[row][p.hour_of_day] = p.total_secs
    sessionGrid[row][p.hour_of_day] = p.session_count
    if (p.total_secs > maxSecs) maxSecs = p.total_secs
  })

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-white">Play Patterns</h2>
      <p className="mt-1 text-sm text-zinc-500">
        When you typically play throughout the week
      </p>

      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[540px]">
          {/* Hour labels */}
          <div className="mb-1 flex pl-10">
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[10px] text-zinc-500"
              >
                {i % 3 === 0 ? getHourLabel(i) : ''}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAY_LABELS.map((dayLabel, rowIdx) => (
            <div key={dayLabel} className="mb-1 flex items-center gap-1">
              <div className="w-9 shrink-0 text-right text-xs text-zinc-500">
                {dayLabel}
              </div>
              <div className="flex flex-1 gap-[2px]">
                {Array.from({ length: 24 }, (_, hourIdx) => {
                  const secs = grid[rowIdx][hourIdx]
                  const sessions = sessionGrid[rowIdx][hourIdx]
                  return (
                    <div
                      key={hourIdx}
                      className={cn(
                        'aspect-square flex-1 rounded-sm transition-colors',
                        getIntensityClass(secs, maxSecs)
                      )}
                      title={
                        secs > 0
                          ? `${dayLabel} ${getHourLabel(hourIdx)} - ${formatDuration(secs)}, ${sessions} session${sessions !== 1 ? 's' : ''}`
                          : `${dayLabel} ${getHourLabel(hourIdx)}`
                      }
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-zinc-500">
        <span>Less</span>
        <div className="h-3 w-3 rounded-sm bg-zinc-800" />
        <div className="h-3 w-3 rounded-sm bg-emerald-900" />
        <div className="h-3 w-3 rounded-sm bg-emerald-700" />
        <div className="h-3 w-3 rounded-sm bg-emerald-500" />
        <div className="h-3 w-3 rounded-sm bg-emerald-400" />
        <span>More</span>
      </div>
    </div>
  )
}
