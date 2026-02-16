'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns'
import { cn, formatDuration } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type SessionData = {
  id: string
  game_id: string | null
  started_at: string
  ended_at: string | null
  duration_secs: number
  active_secs: number
  idle_secs: number
  game_name: string | null
  games: {
    id: string
    name: string
    cover_url: string | null
    genres: string[]
    slug: string
  } | null
}

type GameDaySummary = {
  gameId: string | null
  gameName: string
  coverUrl: string | null
  genres: string[]
  slug: string | null
  totalSecs: number
  sessions: {
    startedAt: string
    endedAt: string | null
    durationSecs: number
  }[]
}

interface CalendarHeatmapProps {
  userId: string
  initialSessions: SessionData[]
  initialYear: number
  initialMonth: number
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_GAMES_SHOWN = 2

function ensureHttps(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('//')) return `https:${url}`
  return url
}

function groupSessionsByDay(sessions: SessionData[]) {
  const map = new Map<string, GameDaySummary[]>()

  sessions.forEach((s) => {
    const dayKey = format(parseISO(s.started_at), 'yyyy-MM-dd')
    if (!map.has(dayKey)) map.set(dayKey, [])

    const dayGames = map.get(dayKey)!
    const gameName = s.games?.name || s.game_name || 'Unknown Game'

    let existing = dayGames.find((g) => g.gameName === gameName)
    if (!existing) {
      existing = {
        gameId: s.games?.id || null,
        gameName,
        coverUrl: ensureHttps(s.games?.cover_url ?? null),
        genres: s.games?.genres || [],
        slug: s.games?.slug || null,
        totalSecs: 0,
        sessions: [],
      }
      dayGames.push(existing)
    }

    existing.totalSecs += s.duration_secs
    existing.sessions.push({
      startedAt: s.started_at,
      endedAt: s.ended_at,
      durationSecs: s.duration_secs,
    })
  })

  return map
}

export function CalendarHeatmap({
  userId,
  initialSessions,
  initialYear,
  initialMonth,
}: CalendarHeatmapProps) {
  const [currentDate, setCurrentDate] = useState(
    new Date(initialYear, initialMonth - 1, 1)
  )
  const [sessions, setSessions] = useState<SessionData[]>(initialSessions)
  const [loading, setLoading] = useState(false)

  // Hover card state
  const [hoveredGame, setHoveredGame] = useState<GameDaySummary | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // "+N more" popover state
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [expandedRect, setExpandedRect] = useState<DOMRect | null>(null)

  const dayGameMap = useMemo(() => groupSessionsByDay(sessions), [sessions])

  const fetchMonth = useCallback(
    async (year: number, month: number) => {
      setLoading(true)
      const supabase = createClient()

      const monthStart = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
      const lastDay = new Date(year, month, 0).getDate()
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59`

      const { data, error } = await supabase
        .from('game_sessions')
        .select(
          `
          id, game_id, started_at, ended_at, duration_secs, active_secs, idle_secs, game_name,
          games (id, name, cover_url, genres, slug)
        `
        )
        .eq('user_id', userId)
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd)
        .order('started_at', { ascending: true })

      if (!error && data) {
        setSessions(data as unknown as SessionData[])
      }
      setLoading(false)
    },
    [userId]
  )

  const goToPrevMonth = () => {
    const prev = subMonths(currentDate, 1)
    setCurrentDate(prev)
    setHoveredGame(null)
    setExpandedDay(null)
    fetchMonth(prev.getFullYear(), prev.getMonth() + 1)
  }

  const goToNextMonth = () => {
    const next = addMonths(currentDate, 1)
    setCurrentDate(next)
    setHoveredGame(null)
    setExpandedDay(null)
    fetchMonth(next.getFullYear(), next.getMonth() + 1)
  }

  // Calendar grid days
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Hover handlers with delay so user can move to the card
  const handleGameHover = (game: GameDaySummary, el: HTMLElement) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoveredGame(game)
    setHoverRect(el.getBoundingClientRect())
  }

  const handleGameLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredGame(null)
      setHoverRect(null)
    }, 150)
  }

  const handleCardEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }

  const handleCardLeave = () => {
    setHoveredGame(null)
    setHoverRect(null)
  }

  const handleMoreClick = (dayKey: string, el: HTMLElement) => {
    if (expandedDay === dayKey) {
      setExpandedDay(null)
      setExpandedRect(null)
    } else {
      setExpandedDay(dayKey)
      setExpandedRect(el.getBoundingClientRect())
    }
  }

  const getExpandedStyle = (): React.CSSProperties => {
    if (!expandedRect) return { display: 'none' }

    const popoverWidth = 220
    const gap = 8
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800

    let left = expandedRect.left
    let top = expandedRect.bottom + gap

    if (left + popoverWidth > vw - 16) {
      left = vw - popoverWidth - 16
    }
    if (top + 200 > vh - 16) {
      top = expandedRect.top - 200 - gap
    }

    return { left, top }
  }

  const getCardStyle = (): React.CSSProperties => {
    if (!hoverRect) return { display: 'none' }

    const cardWidth = 280
    const gap = 12
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800

    let left = hoverRect.right + gap
    let top = hoverRect.top - 40

    // Flip to left if it overflows
    if (left + cardWidth > vw - 16) {
      left = hoverRect.left - cardWidth - gap
    }

    if (top < 16) top = 16
    if (top + 340 > vh - 16) top = vh - 356

    return { left, top }
  }

  return (
    <div className="relative">
      {/* Month navigation */}
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          className="p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
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
          className="p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
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

      {/* Click outside to close expanded popover */}
      {expandedDay && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setExpandedDay(null)
            setExpandedRect(null)
          }}
        />
      )}

      {/* Calendar grid */}
      <div className="overflow-hidden border border-zinc-800 bg-zinc-800">
        <div
          className={cn(
            'grid grid-cols-7 gap-px transition-opacity',
            loading && 'opacity-50'
          )}
        >
          {/* Weekday headers */}
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="bg-zinc-900 px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-zinc-500"
            >
              {label}
            </div>
          ))}

          {/* Day cells */}
          {allDays.map((day) => {
            const inMonth = isSameMonth(day, currentDate)
            const today = isToday(day)
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayGames = inMonth ? dayGameMap.get(dayKey) || [] : []
            const dayTotalSecs = dayGames.reduce((s, g) => s + g.totalSecs, 0)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[110px] p-3',
                  inMonth ? 'bg-zinc-950' : 'bg-zinc-950/40'
                )}
              >
                {/* Date number + total time */}
                <div className="flex items-baseline justify-between">
                  <span
                    className={cn(
                      'text-2xl font-bold leading-none',
                      !inMonth
                        ? 'text-zinc-800'
                        : today
                          ? 'text-emerald-400'
                          : dayGames.length > 0
                            ? 'text-white'
                            : 'text-zinc-700'
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {inMonth && dayTotalSecs >= 60 && (
                    <span className="text-[11px] font-medium text-zinc-500">
                      {formatDuration(dayTotalSecs)}
                    </span>
                  )}
                </div>

                {/* Game entries */}
                {dayGames.length > 0 && (
                  <div className="mt-2.5 space-y-1">
                    {dayGames.slice(0, MAX_GAMES_SHOWN).map((game) => {
                      const inner = (
                        <>
                          <span className="truncate">{game.gameName}</span>
                          <span className="shrink-0 text-[11px] text-zinc-600">
                            {formatDuration(game.totalSecs)}
                          </span>
                        </>
                      )
                      const cls =
                        'flex items-baseline justify-between gap-1.5 text-xs leading-snug text-zinc-400 transition-colors hover:text-emerald-400'
                      return game.gameId ? (
                        <Link
                          key={game.gameName}
                          href={`/games/${game.gameId}`}
                          className={cls}
                          onMouseEnter={(e) =>
                            handleGameHover(game, e.currentTarget)
                          }
                          onMouseLeave={handleGameLeave}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div
                          key={game.gameName}
                          className={cn(cls, 'cursor-default')}
                          onMouseEnter={(e) =>
                            handleGameHover(game, e.currentTarget)
                          }
                          onMouseLeave={handleGameLeave}
                        >
                          {inner}
                        </div>
                      )
                    })}
                    {dayGames.length > MAX_GAMES_SHOWN && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoreClick(dayKey, e.currentTarget)
                        }}
                        className="text-[11px] text-zinc-500 transition-colors hover:text-emerald-400"
                      >
                        +{dayGames.length - MAX_GAMES_SHOWN} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Expanded day popover */}
      {expandedDay && expandedRect && dayGameMap.get(expandedDay) && (
        <div
          className="fixed z-40 w-[220px] overflow-hidden border border-zinc-700 bg-zinc-900 p-2 shadow-xl shadow-black/50"
          style={getExpandedStyle()}
        >
          <div className="mb-1.5 px-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            All games
          </div>
          <div className="space-y-0.5">
            {dayGameMap.get(expandedDay)!.map((game) => {
              const inner = (
                <>
                  <span className="truncate">{game.gameName}</span>
                  <span className="shrink-0 text-zinc-600">
                    {formatDuration(game.totalSecs)}
                  </span>
                </>
              )
              const cls =
                'flex items-baseline justify-between gap-1.5 px-1.5 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-emerald-400'
              return game.gameId ? (
                <Link
                  key={game.gameName}
                  href={`/games/${game.gameId}`}
                  className={cls}
                  onMouseEnter={(e) => handleGameHover(game, e.currentTarget)}
                  onMouseLeave={handleGameLeave}
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={game.gameName}
                  className={cn(cls, 'cursor-default')}
                  onMouseEnter={(e) => handleGameHover(game, e.currentTarget)}
                  onMouseLeave={handleGameLeave}
                >
                  {inner}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Hover card */}
      {hoveredGame && hoverRect && (
        <div
          className="fixed z-50 w-[280px] overflow-hidden border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/50"
          style={getCardStyle()}
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleCardLeave}
        >
          {/* Cover image */}
          {hoveredGame.coverUrl ? (
            <div className="h-36 w-full bg-zinc-800">
              <img
                src={hoveredGame.coverUrl}
                alt={hoveredGame.gameName}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-24 w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
              <svg
                className="h-8 w-8 text-zinc-600"
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
            </div>
          )}

          {/* Card content */}
          <div className="p-4">
            <h4 className="font-semibold text-white">{hoveredGame.gameName}</h4>
            <p className="mt-0.5 text-sm font-medium text-emerald-400">
              {formatDuration(hoveredGame.totalSecs)} played
            </p>

            {/* Session times */}
            <div className="mt-3 space-y-0.5">
              {hoveredGame.sessions.map((s, i) => (
                <p key={i} className="text-xs text-zinc-500">
                  {format(parseISO(s.startedAt), 'h:mm a')}
                  {s.endedAt
                    ? ` \u2013 ${format(parseISO(s.endedAt), 'h:mm a')}`
                    : ' (in progress)'}
                  <span className="ml-1.5 text-zinc-600">
                    {formatDuration(s.durationSecs)}
                  </span>
                </p>
              ))}
            </div>

            {/* Genres */}
            {hoveredGame.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {hoveredGame.genres.map((g) => (
                  <span
                    key={g}
                    className="bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* View game link */}
            {hoveredGame.gameId && (
              <Link
                href={`/games/${hoveredGame.gameId}`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300"
              >
                View Game
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
