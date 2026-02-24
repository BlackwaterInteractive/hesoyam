'use client'

import { formatDuration } from '@/lib/utils'

interface StreakCardsProps {
  /** Array of { date: 'YYYY-MM-DD', total_secs: number } for every day with play time */
  allDaysPlayed: { date: string; total_secs: number }[]
}

function computeStreaks(sortedDates: string[]) {
  if (sortedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const lastPlayedDate = new Date(sortedDates[sortedDates.length - 1])
  lastPlayedDate.setHours(0, 0, 0, 0)

  // Check if the streak is still active (played today or yesterday)
  const streakActive =
    lastPlayedDate.getTime() === today.getTime() ||
    lastPlayedDate.getTime() === yesterday.getTime()

  // Calculate longest streak
  let longestStreak = 1
  let tempStreak = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const current = new Date(sortedDates[i])
    const prev = new Date(sortedDates[i - 1])
    const diffDays =
      Math.round((current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      tempStreak++
    } else {
      if (tempStreak > longestStreak) longestStreak = tempStreak
      tempStreak = 1
    }
  }
  if (tempStreak > longestStreak) longestStreak = tempStreak

  // Calculate current streak from the end
  let currentStreak = 0
  if (streakActive) {
    currentStreak = 1
    for (let i = sortedDates.length - 1; i > 0; i--) {
      const current = new Date(sortedDates[i])
      const prev = new Date(sortedDates[i - 1])
      const diffDays =
        Math.round(
          (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
        )

      if (diffDays === 1) {
        currentStreak++
      } else {
        break
      }
    }
  }

  return { currentStreak, longestStreak }
}

export function StreakCards({ allDaysPlayed }: StreakCardsProps) {
  const playedDates = allDaysPlayed
    .filter((d) => d.total_secs > 0)
    .map((d) => d.date)
    .sort()

  const totalDaysPlayed = playedDates.length
  const totalTimeSecs = allDaysPlayed.reduce((sum, d) => sum + d.total_secs, 0)
  const avgDailyTimeSecs =
    totalDaysPlayed > 0 ? Math.round(totalTimeSecs / totalDaysPlayed) : 0

  const { currentStreak, longestStreak } = computeStreaks(playedDates)

  const stats = [
    {
      label: 'Current Streak',
      value: `${currentStreak}`,
      unit: currentStreak === 1 ? 'day' : 'days',
      highlight: currentStreak > 0,
    },
    {
      label: 'Longest Streak',
      value: `${longestStreak}`,
      unit: longestStreak === 1 ? 'day' : 'days',
      highlight: false,
    },
    {
      label: 'Days Played',
      value: `${totalDaysPlayed}`,
      unit: totalDaysPlayed === 1 ? 'day' : 'days',
      highlight: false,
    },
    {
      label: 'Avg. Daily Play',
      value: formatDuration(avgDailyTimeSecs),
      unit: '',
      highlight: false,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="border border-zinc-800 bg-zinc-900 p-6"
        >
          <p className="text-sm font-medium text-zinc-400">{stat.label}</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <p
              className={
                stat.highlight
                  ? 'text-3xl font-bold text-emerald-500'
                  : 'text-3xl font-bold text-white'
              }
            >
              {stat.value}
            </p>
            {stat.unit && (
              <span className="text-sm text-zinc-500">{stat.unit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
