'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const isStaging = process.env.NODE_ENV !== 'production'

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
 * Includes staleness detection - clears presence if no heartbeat received for 15 seconds.
 */
export function useGamePresence(userId: string): GamePresence | null {
  const [presence, setPresence] = useState<GamePresence | null>(null)

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`presence:${userId}`)
      .on('broadcast', { event: 'game_presence' }, (message) => {
        const payload = message.payload as Omit<GamePresence, 'received_at'>

        if (isStaging) {
          if (payload.event === 'heartbeat') {
            console.debug('[Presence] Heartbeat received:', payload.game_name)
          } else {
            console.debug('[Presence] Received broadcast:', payload.event, payload.game_name)
          }
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
          console.log(`[Presence] Subscribed to presence:${userId}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Presence] Failed to subscribe to presence:${userId}`)
        }
      })

    // Staleness check - clear if no heartbeat for 45 seconds
    // (heartbeats are sent every 30s, so 45s allows for network delays)
    const staleCheck = setInterval(() => {
      setPresence((prev) => {
        if (prev && Date.now() - prev.received_at > 45000) {
          if (isStaging) {
            console.debug('[Presence] Stale presence detected, clearing', {
              game: prev.game_name,
              staleSecs: Math.floor((Date.now() - prev.received_at) / 1000),
            })
          }
          return null
        }
        return prev
      })
    }, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(staleCheck)
    }
  }, [userId])

  return presence
}
