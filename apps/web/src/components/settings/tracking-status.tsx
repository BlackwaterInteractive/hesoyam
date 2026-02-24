'use client'

import type { Profile } from '@/lib/types'

interface TrackingStatusProps {
  profile: Profile
}

export function TrackingStatus({ profile }: TrackingStatusProps) {
  const hasDiscord = !!profile.discord_id
  const hasAgent = !!profile.agent_last_seen

  // Check if agent was active in the last 2 minutes
  const agentActive = hasAgent &&
    new Date(profile.agent_last_seen!).getTime() > Date.now() - 2 * 60 * 1000

  function formatLastSeen(dateString: string | null): string {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <section className="border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Tracking Status</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Your active tracking methods
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* Desktop Agent */}
        <div className="border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-zinc-700">
                <svg className="h-5 w-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">Desktop Agent</p>
                <p className="text-xs text-zinc-500">
                  {hasAgent ? `Last seen: ${formatLastSeen(profile.agent_last_seen)}` : 'Not installed'}
                </p>
              </div>
            </div>
            <div className={`h-2.5 w-2.5 ${agentActive ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
          </div>

          {!hasAgent && (
            <a
              href="/download"
              className="mt-3 block text-center bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-600"
            >
              Download Agent
            </a>
          )}
        </div>

        {/* Discord RP */}
        <div className="border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-[#5865F2]">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">Discord RP</p>
                <p className="text-xs text-zinc-500">
                  {hasDiscord ? 'Connected' : 'Not connected'}
                </p>
              </div>
            </div>
            <div className={`h-2.5 w-2.5 ${hasDiscord ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
          </div>

          {!hasDiscord && (
            <p className="mt-3 text-center text-xs text-zinc-500">
              Connect below to enable
            </p>
          )}
        </div>
      </div>

      {/* Priority Info */}
      {hasAgent && hasDiscord && (
        <div className="mt-4 border border-zinc-700 bg-zinc-800/30 px-4 py-3">
          <p className="text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">Priority:</span> Desktop Agent takes
            priority when running. Discord RP tracking is used as a fallback.
          </p>
        </div>
      )}
    </section>
  )
}
