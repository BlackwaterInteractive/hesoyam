'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { debugLog } from '@/lib/debug-log'

const MAX_RETRIES = 5
const BASE_RETRY_MS = 1000

export interface GamePresence {
  user_id: string
  game_id: string
  game_name: string
  game_slug: string
  cover_url: string | null
  started_at: string
  event: 'start' | 'heartbeat' | 'end'
  received_at: number
}

/**
 * Subscribe to real-time game presence updates via Supabase Broadcast.
 * Returns the current presence state or null if not playing.
 *
 * Handles WebSocket disconnects with exponential backoff retry.
 * Includes staleness detection - clears presence if no heartbeat received for 45 seconds.
 */
export function useGamePresence(userId: string): GamePresence | null {
  const [presence, setPresence] = useState<GamePresence | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!userId) return

    const supabase = supabaseRef.current
    let retryCount = 0
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    function subscribe() {
      if (cancelled) return

      const channel = supabase
        .channel(`presence:${userId}`, {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'game_presence' }, (message) => {
          const payload = message.payload as Omit<GamePresence, 'received_at'>

          if (payload.event === 'heartbeat') {
            debugLog('Presence', 'Heartbeat received:', { game: payload.game_name })
          } else {
            debugLog('Presence', 'Received broadcast:', { event: payload.event, game: payload.game_name })
          }

          if (payload.event === 'end') {
            setPresence(null)
          } else {
            setPresence({
              ...payload,
              received_at: Date.now(),
            })
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            retryCount = 0
            debugLog('Presence', `Subscribed to presence:${userId}`)
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Presence] ${status} on presence:${userId}, retry ${retryCount + 1}/${MAX_RETRIES}`)

            supabase.removeChannel(channel)

            if (retryCount < MAX_RETRIES) {
              const delay = BASE_RETRY_MS * Math.pow(2, retryCount)
              retryCount++

              debugLog('Presence', `Retrying in ${delay}ms`)

              retryTimeout = setTimeout(subscribe, delay)
            } else {
              console.error(`[Presence] Max retries reached for presence:${userId}`)
            }
          }
        })

      return channel
    }

    const channel = subscribe()

    // Staleness check - clear if no heartbeat for 45 seconds
    // (heartbeats are sent every 30s, so 45s allows for network delays)
    const staleCheck = setInterval(() => {
      setPresence((prev) => {
        if (prev && Date.now() - prev.received_at > 45000) {
          debugLog('Presence', 'Stale presence detected, clearing', {
            game: prev.game_name,
            staleSecs: Math.floor((Date.now() - prev.received_at) / 1000),
          })
          return null
        }
        return prev
      })
    }, 5000)

    return () => {
      cancelled = true
      if (retryTimeout) clearTimeout(retryTimeout)
      if (channel) supabase.removeChannel(channel)
      clearInterval(staleCheck)
    }
  }, [userId])

  return presence
}
