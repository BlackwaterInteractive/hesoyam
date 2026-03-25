'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { debugLog } from '@/lib/debug-log'
import type { RealtimeChannel } from '@supabase/supabase-js'

export default function JoinServerPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [hasClickedJoin, setHasClickedJoin] = useState(false)
  const [joined, setJoined] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    async function checkGuildStatus() {
      try {
        const supabase = createClient()

        const { data: config } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'discord_invite_url')
          .single()

        if (config?.value) {
          setInviteUrl(typeof config.value === 'string' ? config.value : String(config.value))
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setChecking(false)
          return
        }

        setUserId(user.id)

        const { data: profile } = await supabase
          .from('profiles')
          .select('in_guild')
          .eq('id', user.id)
          .single()

        debugLog('join-server', 'profile check:', { in_guild: profile?.in_guild, userId: user.id })

        if (profile?.in_guild) {
          debugLog('join-server', 'already in guild, redirecting to dashboard')
          router.push('/dashboard')
          router.refresh()
          return
        }
      } catch (err) {
        console.error('[join-server] Failed to check guild status:', err)
      }

      setChecking(false)
    }
    checkGuildStatus()
  }, [router])

  useEffect(() => {
    if (!hasClickedJoin || !userId) return

    debugLog('join-server', 'subscribing to realtime for user:', { userId })

    const supabase = createClient()
    const channel = supabase
      .channel('join-server-guild')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          debugLog('join-server', 'realtime payload received:', payload)
          debugLog('join-server', 'in_guild value:', { in_guild: payload.new.in_guild })
          if (payload.new.in_guild === true) {
            debugLog('join-server', 'guild join detected! redirecting in 1.5s...')
            setJoined(true)
            setTimeout(() => {
              router.push('/dashboard')
              router.refresh()
            }, 1500)
          }
        }
      )
      .subscribe((status) => {
        debugLog('join-server', 'realtime subscription status:', { status })
      })

    channelRef.current = channel

    return () => {
      debugLog('join-server', 'cleaning up realtime channel')
      supabase.removeChannel(channel)
    }
  }, [hasClickedJoin, userId, router])

  function handleJoinClick() {
    debugLog('join-server', 'join button clicked', { inviteUrl })
    setHasClickedJoin(true)
    if (inviteUrl) {
      window.open(inviteUrl, '_blank', 'noopener,noreferrer')
    }
  }

  function handleSkip() {
    router.push('/dashboard')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="flex justify-center py-8">
        <svg className="h-5 w-5 animate-spin text-zinc-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div>
      <h2
        className="text-2xl font-bold text-white"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
      >
        Join the Discord server
      </h2>
      <p className="mt-2 mb-8 text-sm text-zinc-500">
        Join the RAID Discord server so we can track your gaming activity via
        Rich Presence. Works with PC games and console games if your PlayStation
        or Xbox is connected to Discord.
      </p>

      <div className="space-y-3">
        {joined ? (
          <div className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-400">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            You&apos;re in — redirecting...
          </div>
        ) : hasClickedJoin ? (
          <button
            disabled
            className="w-full flex items-center justify-center gap-3 bg-[#5865F2]/50 px-4 py-3 text-sm font-semibold text-white/60 cursor-wait"
          >
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Waiting for you to join...
          </button>
        ) : (
          <button
            onClick={handleJoinClick}
            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4752C4]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Join Discord Server
          </button>
        )}

        <button
          onClick={handleSkip}
          className="w-full border border-white/10 px-4 py-3 text-sm font-medium text-zinc-500 transition hover:border-white/20 hover:text-zinc-300"
        >
          Skip for now
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-600">
        You can always join later from your settings.
      </p>
    </div>
  )
}
