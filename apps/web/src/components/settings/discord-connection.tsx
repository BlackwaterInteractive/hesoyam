'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { connectDiscord } from '@/app/(dashboard)/settings/actions'
import type { Profile } from '@/lib/types'

interface DiscordConnectionProps {
  profile: Profile
}

const DISCORD_INVITE_URL = 'https://discord.gg/hesoyam' // Update with actual invite URL

export function DiscordConnection({ profile }: DiscordConnectionProps) {
  const [discordId, setDiscordId] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const isConnected = !!profile.discord_id

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setToast(null)

    if (!discordId.trim()) {
      setToast({ type: 'error', message: 'Please enter your Discord User ID.' })
      return
    }

    startTransition(async () => {
      const result = await connectDiscord(discordId.trim())
      if (result.success) {
        setToast({ type: 'success', message: 'Discord connected successfully!' })
        setDiscordId('')
      } else {
        setToast({ type: 'error', message: result.error || 'Something went wrong.' })
      }
    })
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5865F2]">
          <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Discord Connection</h2>
          <p className="text-sm text-zinc-400">
            Track games via Discord Rich Presence
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'mt-4 rounded-lg border px-4 py-3 text-sm',
            toast.type === 'success'
              ? 'border-emerald-800 bg-emerald-950 text-emerald-300'
              : 'border-red-800 bg-red-950 text-red-300'
          )}
        >
          {toast.message}
        </div>
      )}

      {isConnected ? (
        /* Connected State */
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-400">Connected</span>
          </div>

          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500">Discord User ID</p>
                <p className="font-mono text-sm text-zinc-300">{profile.discord_id}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Connected On</p>
                <p className="text-sm text-zinc-300">
                  {formatDate(profile.discord_connected_at)}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Your gaming activity will be tracked when you&apos;re in the Hesoyam Discord
            server and Discord detects a game.
          </p>
        </div>
      ) : (
        /* Not Connected State */
        <div className="mt-5 space-y-5">
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-sm text-zinc-300">
              Track your gaming activity via Discord Rich Presence. This works with PC games
              and even console games if your PlayStation or Xbox is connected to Discord.
            </p>
          </div>

          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                1
              </span>
              <p className="text-sm font-medium text-zinc-200">Join the Hesoyam Discord Server</p>
            </div>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-8 inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4752C4]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Server
            </a>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                2
              </span>
              <p className="text-sm font-medium text-zinc-200">Enter Your Discord User ID</p>
            </div>

            <form onSubmit={handleSubmit} className="ml-8 space-y-3">
              <div>
                <input
                  type="text"
                  value={discordId}
                  onChange={(e) => setDiscordId(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456789012345678"
                  maxLength={19}
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                  <a
                    href="https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline"
                  >
                    How to find your Discord User ID
                  </a>
                </p>
              </div>

              <button
                type="submit"
                disabled={isPending || !discordId.trim()}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
                  isPending || !discordId.trim()
                    ? 'cursor-not-allowed bg-emerald-800 opacity-50'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                )}
              >
                {isPending ? 'Connecting...' : 'Connect Discord'}
              </button>
            </form>
          </div>

          {/* Warning */}
          <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3">
            <p className="text-xs text-amber-300/90">
              <strong>Note:</strong> Once connected, your Discord ID cannot be changed.
              Make sure you enter the correct ID.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
