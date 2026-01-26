'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type CalendarDay = {
  day: number
  total_secs: number
  session_count: number
  game_count: number
}

interface CalendarHeatmapProps {
  userId: string
  initialData: CalendarDay[]
  initialYear: number
  initialMonth: number
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getIntensityClass(totalSecs: number): string {
  if (totalSecs === 0) return 'bg-zinc-800'
  if (totalSecs < 1800) return 'bg-emerald-900'      // < 30 min
  if (totalSecs < 3600) return 'bg-emerald-700'       // < 1 hour
  if (totalSecs < 7200) return 'bg-emerald-500'       // < 2 hours
  return 'bg-emerald-400'                              // 2+ hours
}

export function CalendarHeatmap({
  userId,
  initialData,
  initialYear,
  initialMonth,
}: CalendarHeatmapProps) {
  const [currentDate, setCurrentDate] = useState(
    new Date(initialYear, initialMonth - 1, 1)
  )
  const [calendarData, setCalendarData] = useState<CalendarDay[]>(initialData)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchMonth = useCallback(
    async (year: number, month: number) => {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_calendar_data', {
        p_user_id: userId,
        p_year: year,
        p_month: month,
      })

      if (!error && data) {
        setCalendarData(data as CalendarDay[])
      }
      setLoading(false)
    },
    [userId]
  )

  const goToPrevMonth = () => {
    const prev = subMonths(currentDate, 1)
    setCurrentDate(prev)
    setSelectedDate(null)
    fetchMonth(prev.getFullYear(), prev.getMonth() + 1)
  }

  const goToNextMonth = () => {
    const next = addMonths(currentDate, 1)
    setCurrentDate(next)
    setSelectedDate(null)
    fetchMonth(next.getFullYear(), next.getMonth() + 1)
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)

  // Build the calendar grid starting on Monday
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Build a lookup map: day number -> data
  const dataMap = new Map<number, CalendarDay>()
  calendarData.forEach((d) => dataMap.set(d.day, d))

  const handleDayClick = (day: Date) => {
    if (!isSameMonth(day, currentDate)) return
    const newSelected =
      selectedDate && isSameDay(selectedDate, day) ? null : day
    setSelectedDate(newSelected)
  }

  // Dispatch a custom event so the DaySessions component knows which day is selected
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('hesoyam:day-selected', {
        detail: selectedDate
          ? {
              date: format(selectedDate, 'yyyy-MM-dd'),
              year: selectedDate.getFullYear(),
              month: selectedDate.getMonth() + 1,
              day: selectedDate.getDate(),
            }
          : null,
      })
    )
  }, [selectedDate])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      {/* Month navigation header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          aria-label="Previous month"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m15 18-6-6 6-6"
            />
          </svg>
        </button>

        <h2 className="text-lg font-semibold text-white">
          {format(currentDate, 'MMMM yyyy')}
        </h2>

        <button
          onClick={goToNextMonth}
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          aria-label="Next month"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m9 18 6-6-6-6"
            />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-xs font-medium text-zinc-500"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        className={cn(
          'grid grid-cols-7 gap-1 transition-opacity',
          loading && 'opacity-50'
        )}
      >
        {allDays.map((day) => {
          const inMonth = isSameMonth(day, currentDate)
          const dayNum = day.getDate()
          const dayData = inMonth ? dataMap.get(dayNum) : undefined
          const totalSecs = dayData?.total_secs ?? 0
          const isSelected = selectedDate ? isSameDay(selectedDate, day) : false

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              disabled={!inMonth}
              className={cn(
                'relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-all',
                inMonth
                  ? [
                      getIntensityClass(totalSecs),
                      'cursor-pointer hover:ring-2 hover:ring-emerald-500/50',
                      isSelected && 'ring-2 ring-emerald-400',
                    ]
                  : 'cursor-default bg-transparent text-zinc-700'
              )}
              title={
                inMonth && dayData
                  ? `${formatDuration(totalSecs)} - ${dayData.session_count} session${dayData.session_count !== 1 ? 's' : ''}`
                  : undefined
              }
            >
              <span
                className={cn(
                  'font-medium',
                  inMonth
                    ? totalSecs > 0
                      ? 'text-white'
                      : 'text-zinc-400'
                    : 'text-zinc-700'
                )}
              >
                {dayNum}
              </span>
              {inMonth && dayData && dayData.session_count > 0 && (
                <span className="mt-0.5 text-[10px] leading-none text-zinc-300">
                  {formatDuration(totalSecs)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-zinc-500">
        <span>Less</span>
        <div className="h-3 w-3 rounded bg-zinc-800" />
        <div className="h-3 w-3 rounded bg-emerald-900" />
        <div className="h-3 w-3 rounded bg-emerald-700" />
        <div className="h-3 w-3 rounded bg-emerald-500" />
        <div className="h-3 w-3 rounded bg-emerald-400" />
        <span>More</span>
      </div>
    </div>
  )
}
