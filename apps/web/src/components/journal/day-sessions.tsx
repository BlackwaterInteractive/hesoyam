'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { formatDuration } from '@/lib/utils'

type SessionWithGame = {
  id: string
  started_at: string
  ended_at: string | null
  duration_secs: number
  active_secs: number
  idle_secs: number
  game_name: string | null
  games: {
    name: string
    cover_url: string | null
    genres: string[]
  } | null
}

interface DaySessionsProps {
  userId: string
}

export function DaySessions({ userId }: DaySessionsProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionWithGame[]>([])
  const [loading, setLoading] = useState(false)

  // Listen for day selection events from the calendar heatmap
  useEffect(() => {
    function handleDaySelected(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail) {
        setSelectedDate(detail.date)
      } else {
        setSelectedDate(null)
        setSessions([])
      }
    }

    window.addEventListener('hesoyam:day-selected', handleDaySelected)
    return () =>
      window.removeEventListener('hesoyam:day-selected', handleDaySelected)
  }, [])

  // Fetch sessions when a day is selected
  useEffect(() => {
    if (!selectedDate) return

    async function fetchSessions() {
      setLoading(true)
      const supabase = createClient()

      const dayStart = `${selectedDate}T00:00:00`
      const dayEnd = `${selectedDate}T23:59:59`

      const { data, error } = await supabase
        .from('game_sessions')
        .select(
          `
          id,
          started_at,
          ended_at,
          duration_secs,
          active_secs,
          idle_secs,
          game_name,
          games (
            name,
            cover_url,
            genres
          )
        `
        )
        .eq('user_id', userId)
        .gte('started_at', dayStart)
        .lte('started_at', dayEnd)
        .order('started_at', { ascending: true })

      if (!error && data) {
        setSessions(data as unknown as SessionWithGame[])
      }
      setLoading(false)
    }

    fetchSessions()
  }, [selectedDate, userId])

  if (!selectedDate) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-center text-sm text-zinc-500">
          Select a day on the calendar to view sessions
        </p>
      </div>
    )
  }

  const formattedDate = format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')
  const totalDaySecs = sessions.reduce((sum, s) => sum + s.duration_secs, 0)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{formattedDate}</h3>
        {sessions.length > 0 && (
          <span className="text-sm text-zinc-500">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}{' '}
            &middot; {formatDuration(totalDaySecs)} total
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-500" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">
          No sessions recorded on this day
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-zinc-700"
            >
              {/* Game cover */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-800">
                {session.games?.cover_url ? (
                  <img
                    src={session.games.cover_url}
                    alt={session.games.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg
                    className="h-5 w-5 text-zinc-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875S10.5 3.09 10.5 4.125c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.491 48.491 0 01-4.163-.3c-1.18-.143-2.18.784-2.18 1.976v.2c0 .97.675 1.82 1.62 2.044a30.089 30.089 0 004.862.87.64.64 0 01.575.643v0a.64.64 0 01-.574.643 30.089 30.089 0 00-4.862.87C4.925 13.43 4.25 14.28 4.25 15.25v.2c0 1.192 1 2.12 2.18 1.976a48.491 48.491 0 014.163-.3.64.64 0 01.657.643v0c0 .355-.186.676-.401.959-.221.29-.349.634-.349 1.003 0 1.035 1.007 1.875 2.25 1.875s2.25-.84 2.25-1.875c0-.369-.128-.713-.349-1.003-.215-.283-.401-.604-.401-.959v0a.64.64 0 01.657-.643 48.491 48.491 0 014.163.3c1.18.143 2.18-.784 2.18-1.976v-.2c0-.97-.675-1.82-1.62-2.044a30.089 30.089 0 00-4.862-.87.64.64 0 01-.575-.643v0a.64.64 0 01.574-.643 30.089 30.089 0 004.863-.87c.944-.224 1.619-1.074 1.619-2.044v-.2c0-1.192-1-2.12-2.18-1.976a48.491 48.491 0 01-4.163.3.64.64 0 01-.657-.643v0z"
                    />
                  </svg>
                )}
              </div>

              {/* Session info */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {session.games?.name || session.game_name || 'Unknown Game'}
                </p>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {format(parseISO(session.started_at), 'h:mm a')}
                  {session.ended_at
                    ? ` - ${format(parseISO(session.ended_at), 'h:mm a')}`
                    : ' (in progress)'}
                </p>
              </div>

              {/* Duration */}
              <div className="shrink-0 text-right">
                <p className="font-semibold text-emerald-500">
                  {formatDuration(session.duration_secs)}
                </p>
                {session.idle_secs > 60 && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatDuration(session.idle_secs)} idle
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
