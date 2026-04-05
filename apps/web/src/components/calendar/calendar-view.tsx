'use client'

import { useState, useMemo, useCallback } from 'react'
import { format, isSameDay, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { CalendarDateNav } from './calendar-date-nav'
import { CalendarGameCard } from './calendar-game-card'
import type { Game } from '@/lib/types'

type SessionData = {
  id: string
  game_id: string | null
  game_name: string | null
  started_at: string
  ended_at: string | null
  duration_secs: number
  games: {
    id: string
    name: string
    cover_url: string | null
    developer: string | null
    publisher: string | null
    slug: string
  } | null
}

type UserGameData = {
  game_id: string
  total_time_secs: number
}

type DayGameEntry = {
  game: Game
  sessionCount: number
  dayPlaytimeSecs: number
  allTimePlaytimeSecs: number | null
}

interface CalendarViewProps {
  userId: string
  initialSessions: SessionData[]
  initialUserGames: UserGameData[]
  initialYear: number
  initialMonth: number
}

function groupSessionsForDay(
  sessions: SessionData[],
  date: Date,
  userGames: UserGameData[]
): DayGameEntry[] {
  const dayKey = format(date, 'yyyy-MM-dd')
  const daySessions = sessions.filter(
    (s) => format(parseISO(s.started_at), 'yyyy-MM-dd') === dayKey
  )

  const gameMap = new Map<string, DayGameEntry>()

  for (const s of daySessions) {
    const gameId = s.games?.id ?? s.game_id ?? null
    const mapKey = gameId ?? s.game_name ?? 'unknown'

    if (!gameMap.has(mapKey)) {
      const game: Game = {
        id: gameId ?? mapKey,
        name: s.games?.name ?? s.game_name ?? 'Unknown Game',
        slug: s.games?.slug ?? '',
        cover_url: s.games?.cover_url ?? null,
        developer: s.games?.developer ?? null,
        publisher: s.games?.publisher ?? null,
        igdb_id: null,
        genres: null,
        release_year: null,
        description: null,
        platforms: null,
        screenshots: null,
        artwork_url: null,
        igdb_url: null,
        rating: null,
        rating_count: null,
        first_release_date: null,
        igdb_updated_at: null,
        metadata_source: null,
        discord_application_id: null,
        created_at: '',
      }
      const userGame = gameId ? userGames.find((ug) => ug.game_id === gameId) : null
      gameMap.set(mapKey, {
        game,
        sessionCount: 0,
        dayPlaytimeSecs: 0,
        allTimePlaytimeSecs: userGame ? userGame.total_time_secs : null,
      })
    }

    const entry = gameMap.get(mapKey)!
    entry.sessionCount += 1
    entry.dayPlaytimeSecs += s.duration_secs
  }

  return Array.from(gameMap.values())
}

export function CalendarView({
  userId,
  initialSessions,
  initialUserGames,
  initialYear,
  initialMonth,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(
    () => new Date(initialYear, initialMonth - 1, new Date().getDate())
  )
  const [sessions, setSessions] = useState<SessionData[]>(initialSessions)
  const [userGames] = useState<UserGameData[]>(initialUserGames)
  const [loadedMonths] = useState<Set<string>>(
    () => new Set([`${initialYear}-${String(initialMonth).padStart(2, '0')}`])
  )
  const [loadingMonths, setLoadingMonths] = useState(false)

  const fetchMonthSessions = useCallback(
    async (year: number, month: number) => {
      const key = `${year}-${String(month).padStart(2, '0')}`
      if (loadedMonths.has(key)) return
      setLoadingMonths(true)

      const supabase = createClient()
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
      const lastDay = new Date(year, month, 0).getDate()
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59`

      const { data, error } = await supabase
        .from('game_sessions')
        .select(
          `id, game_id, game_name, started_at, ended_at, duration_secs,
           games (id, name, cover_url, developer, publisher, slug)`
        )
        .eq('user_id', userId)
        .gte('started_at', monthStart)
        .lte('started_at', monthEnd)
        .order('started_at', { ascending: true })

      if (!error && data) {
        setSessions((prev) => [...prev, ...(data as unknown as SessionData[])])
        loadedMonths.add(key)
      }
      setLoadingMonths(false)
    },
    [userId, loadedMonths]
  )

  const handleDateChange = useCallback(
    (date: Date) => {
      setSelectedDate(date)
      fetchMonthSessions(date.getFullYear(), date.getMonth() + 1)
    },
    [fetchMonthSessions]
  )

  const dayEntries = useMemo(
    () => groupSessionsForDay(sessions, selectedDate, userGames),
    [sessions, selectedDate, userGames]
  )

  return (
    <div>
      <CalendarDateNav selectedDate={selectedDate} onDateChange={handleDateChange} />

      <div className="px-[40px] pt-[40px]" style={{ opacity: loadingMonths ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        {dayEntries.length === 0 ? (
          <p
            className="text-[14px] text-[#595959]"
            style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}
          >
            No sessions on this day.
          </p>
        ) : (
          <div className="flex flex-wrap justify-center gap-x-[16px] gap-y-[32px]">
            {dayEntries.map(({ game, sessionCount, dayPlaytimeSecs, allTimePlaytimeSecs }) => (
              <div key={game.id} style={{ width: '176px' }}>
                <CalendarGameCard
                  game={game}
                  sessionCount={sessionCount}
                  dayPlaytimeSecs={dayPlaytimeSecs}
                  allTimePlaytimeSecs={allTimePlaytimeSecs}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
