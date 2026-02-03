'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGamePresence } from '@/hooks/use-game-presence'
import type { GameSession, Game } from '@/lib/types'

interface LiveSessionData {
  session: GameSession
  game: Game
}

interface LiveSessionCardProps {
  initialSession: LiveSessionData | null
  userId: string
}

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  const diffSecs = Math.max(0, Math.floor((now - start) / 1000))

  const hours = Math.floor(diffSecs / 3600)
  const minutes = Math.floor((diffSecs % 3600) / 60)
  const seconds = diffSecs % 60

  const pad = (n: number) => n.toString().padStart(2, '0')

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

export function LiveSessionCard({
  initialSession,
  userId,
}: LiveSessionCardProps) {
  const [dbSession, setDbSession] = useState<LiveSessionData | null>(
    initialSession
  )
  const [elapsed, setElapsed] = useState('')

  // Subscribe to real-time presence broadcasts (instant updates)
  const presence = useGamePresence(userId)

  // Build session data from presence if available, otherwise fall back to DB
  const liveSession = useMemo<LiveSessionData | null>(() => {
    if (presence) {
      return {
        session: {
          id: `presence-${presence.game_id}`,
          user_id: presence.user_id,
          game_id: presence.game_id,
          started_at: presence.started_at,
          ended_at: null,
          duration_secs: 0,
          active_secs: 0,
          idle_secs: 0,
          created_at: presence.started_at,
          updated_at: new Date().toISOString(),
        },
        game: {
          id: presence.game_id,
          igdb_id: null,
          name: presence.game_name,
          slug: presence.game_slug,
          cover_url: presence.cover_url,
          genres: [],
          developer: null,
          release_year: null,
          created_at: presence.started_at,
        },
      }
    }
    return dbSession
  }, [presence, dbSession])

  // Update elapsed timer
  useEffect(() => {
    if (!liveSession) return

    const update = () => {
      setElapsed(formatElapsed(liveSession.session.started_at))
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [liveSession])

  // Subscribe to realtime changes on game_sessions (fallback for DB-based updates)
  const fetchDbSession = useCallback(async () => {
    const supabase = createClient()
    const { data: sessions } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)

    if (sessions && sessions.length > 0) {
      const session = sessions[0]
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('id', session.game_id)
        .single()

      if (game) {
        setDbSession({ session, game })
      }
    } else {
      setDbSession(null)
    }
  }, [userId])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('live-session-db')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchDbSession()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchDbSession])

  if (!liveSession) return null

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Pulsing green dot */}
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-medium text-emerald-400">
            Currently Playing
          </span>
        </div>
        <span className="font-mono text-lg font-bold text-white">
          {elapsed}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        {liveSession.game.cover_url ? (
          <img
            src={liveSession.game.cover_url}
            alt={liveSession.game.name}
            className="h-14 w-10 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-14 w-10 items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-500">
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
                d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875S10.5 3.09 10.5 4.125c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.491 48.491 0 01-4.163-.3c-1.18-.143-2.18.784-2.18 1.976v.2c0 .97.675 1.82 1.62 2.044a30.089 30.089 0 004.862.87.64.64 0 01.575.643v0a.64.64 0 01-.574.643 30.089 30.089 0 00-4.862.87C4.925 13.43 4.25 14.28 4.25 15.25v.2c0 1.192 1 2.12 2.18 1.976a48.491 48.491 0 014.163-.3.64.64 0 01.657.643v0c0 .355-.186.676-.401.959-.221.29-.349.634-.349 1.003 0 1.035 1.007 1.875 2.25 1.875s2.25-.84 2.25-1.875c0-.369-.128-.713-.349-1.003-.215-.283-.401-.604-.401-.959v0a.64.64 0 01.657-.643 48.491 48.491 0 014.163.3c1.18.143 2.18-.784 2.18-1.976v-.2c0-.97-.675-1.82-1.62-2.044a30.089 30.089 0 00-4.862-.87.64.64 0 01-.575-.643v0a.64.64 0 01.574-.643 30.089 30.089 0 004.863-.87c.944-.224 1.619-1.074 1.619-2.044v-.2c0-1.192-1-2.12-2.18-1.976a48.491 48.491 0 01-4.163.3.64.64 0 01-.657-.643v0z"
              />
            </svg>
          </div>
        )}
        <div>
          <p className="text-lg font-semibold text-white">
            {liveSession.game.name}
          </p>
          {liveSession.game.genres && liveSession.game.genres.length > 0 && (
            <p className="text-sm text-zinc-500">
              {liveSession.game.genres.slice(0, 3).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
