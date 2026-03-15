'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGamePresence } from '@/hooks/use-game-presence'
import { GameplayCard } from './gameplay-card'
import type { Game, GameSession } from '@/lib/types'

interface SessionData {
  session: GameSession
  game: Game
}

interface GameplayCardClientProps {
  initialSession: SessionData | null
  lastSession: SessionData | null
  userId: string
}

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime()
  const diffSecs = Math.max(0, Math.floor((Date.now() - start) / 1000))
  const h = Math.floor(diffSecs / 3600)
  const m = Math.floor((diffSecs % 3600) / 60)
  const s = diffSecs % 60
  const pad = (n: number) => n.toString().padStart(2, '0')

  if (diffSecs < 60) return `${s}s`
  if (h === 0) return `${pad(m)}m ${pad(s)}s`
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`
}

function formatDurationShort(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

const GRACE_PERIOD_MS = 8000

export function GameplayCardClient({ initialSession, lastSession, userId }: GameplayCardClientProps) {
  const router = useRouter()
  const [dbSession, setDbSession] = useState<SessionData | null>(initialSession)
  const [elapsed, setElapsed] = useState('')
  const [inGrace, setInGrace] = useState(false)
  const prevLiveRef = useRef<SessionData | null>(initialSession)
  const hasFetchedRef = useRef(false)
  const presenceEverReceivedRef = useRef(false)
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const presence = useGamePresence(userId)

  if (presence) presenceEverReceivedRef.current = true

  // Fetch DB session when presence starts to get rich game metadata
  const fetchDbSession = useCallback(async () => {
    const supabase = createClient()
    const { data: sessions } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)

    if (!sessions?.length) { setDbSession(null); return }

    const session = sessions[0]
    let game: Game | null = null

    if (session.game_id) {
      const { data } = await supabase.from('games').select('*').eq('id', session.game_id).single()
      game = data
    }

    if (!game && session.game_name) {
      game = {
        id: `discord-${session.id}`, igdb_id: null, name: session.game_name,
        slug: session.game_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        cover_url: null, genres: null, developer: null, release_year: null,
        description: null, publisher: null, platforms: null, screenshots: null,
        artwork_url: null, igdb_url: null, rating: null, rating_count: null,
        first_release_date: null, igdb_updated_at: null, metadata_source: null,
        created_at: session.created_at,
      }
    }

    if (game) setDbSession({ session, game })
    else setDbSession(null)
  }, [userId])

  // Handle presence changes
  useEffect(() => {
    if (presence && !dbSession && !hasFetchedRef.current) {
      hasFetchedRef.current = true
      const timer = setTimeout(fetchDbSession, 1500)
      return () => clearTimeout(timer)
    }
    if (!presence) {
      hasFetchedRef.current = false
      if (dbSession && presenceEverReceivedRef.current) setDbSession(null)
    }
  }, [presence, dbSession, fetchDbSession])

  // Build merged live session (presence + db metadata)
  const liveSession: SessionData | null = presence
    ? {
        session: {
          id: dbSession?.session.id ?? `presence-${presence.game_id}`,
          user_id: presence.user_id,
          game_id: presence.game_id,
          game_name: presence.game_name,
          started_at: presence.started_at,
          ended_at: null,
          duration_secs: 0, active_secs: 0, idle_secs: 0,
          source: 'discord' as const,
          created_at: presence.started_at,
          updated_at: new Date().toISOString(),
        },
        game: {
          id: dbSession?.game.id ?? presence.game_id,
          igdb_id: dbSession?.game.igdb_id ?? null,
          name: presence.game_name,
          slug: dbSession?.game.slug ?? presence.game_slug,
          cover_url: presence.cover_url ?? dbSession?.game.cover_url ?? null,
          genres: dbSession?.game.genres ?? null,
          developer: dbSession?.game.developer ?? null,
          release_year: dbSession?.game.release_year ?? null,
          description: dbSession?.game.description ?? null,
          publisher: dbSession?.game.publisher ?? null,
          platforms: dbSession?.game.platforms ?? null,
          screenshots: dbSession?.game.screenshots ?? null,
          artwork_url: dbSession?.game.artwork_url ?? null,
          igdb_url: dbSession?.game.igdb_url ?? null,
          rating: dbSession?.game.rating ?? null,
          rating_count: dbSession?.game.rating_count ?? null,
          first_release_date: dbSession?.game.first_release_date ?? null,
          igdb_updated_at: dbSession?.game.igdb_updated_at ?? null,
          metadata_source: dbSession?.game.metadata_source ?? null,
          created_at: dbSession?.game.created_at ?? presence.started_at,
        },
      }
    : dbSession

  // Refresh page and trigger grace period when session ends
  useEffect(() => {
    const wasPlaying = prevLiveRef.current !== null
    const isPlaying = liveSession !== null
    prevLiveRef.current = liveSession

    if (wasPlaying && !isPlaying) {
      setInGrace(true)
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current)
      graceTimerRef.current = setTimeout(() => {
        setInGrace(false)
        router.refresh()
      }, GRACE_PERIOD_MS)
    }

    if (isPlaying) {
      setInGrace(false)
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current)
    }

    return () => {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current)
    }
  }, [liveSession, router])

  // Live elapsed timer
  useEffect(() => {
    if (!liveSession) return
    const update = () => setElapsed(formatElapsed(liveSession.session.started_at))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [liveSession])

  // Determine display values
  const isPlaying = !!liveSession
  const activeSession = liveSession ?? lastSession
  const glowStatus = isPlaying ? 'live' : inGrace ? 'grace' : 'none'

  if (!activeSession) {
    return (
      <GameplayCard
        status="No sessions yet"
        gameName="Start playing a game"
        subtitle=""
        playtime="--"
        coverUrl={null}
        glowStatus="none"
      />
    )
  }

  return (
    <GameplayCard
      status={isPlaying ? 'You are currently playing' : 'You just played'}
      gameName={activeSession.game.name}
      subtitle={isPlaying ? 'for the last' : 'for'}
      playtime={isPlaying ? elapsed : formatDurationShort(activeSession.session.duration_secs)}
      coverUrl={activeSession.game.cover_url}
      glowStatus={glowStatus as 'live' | 'grace' | 'none'}
    />
  )
}
