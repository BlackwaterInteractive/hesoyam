'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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

    // Staleness check - clear if no heartbeat for 15 seconds
    const staleCheck = setInterval(() => {
      setPresence((prev) => {
        if (prev && Date.now() - prev.received_at > 15000) {
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
