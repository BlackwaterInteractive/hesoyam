'use client'

import { formatDuration, formatDate } from '@/lib/utils'
import type { GameSession, Game } from '@/lib/types'

interface SessionWithGame extends GameSession {
  games: Pick<Game, 'id' | 'name' | 'cover_url'> | null
}

interface RecentSessionsProps {
  sessions: SessionWithGame[]
}

export function RecentSessions({ sessions }: RecentSessionsProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white">Recent Sessions</h2>
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <svg
            className="h-12 w-12 text-zinc-700"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-3 text-sm text-zinc-500">No sessions yet</p>
          <p className="mt-1 text-xs text-zinc-600">
            Start playing a game to see your sessions here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recent Sessions</h2>
        <a
          href="/journal"
          className="text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          View all
        </a>
      </div>

      <div className="mt-4 space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center gap-4 rounded-lg border border-zinc-800/50 bg-zinc-950/50 px-4 py-3"
          >
            {/* Game cover */}
            {session.games?.cover_url ? (
              <img
                src={session.games.cover_url}
                alt={session.games.name}
                className="h-10 w-7 rounded object-cover"
              />
            ) : (
              <div className="flex h-10 w-7 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-600">
                <svg
                  className="h-4 w-4"
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

            {/* Game info */}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {session.games?.name || session.game_name || 'Unknown Game'}
              </p>
              <p className="text-xs text-zinc-500">
                {formatDate(session.started_at)}
              </p>
            </div>

            {/* Duration */}
            <div className="text-right">
              <p className="text-sm font-medium text-zinc-300">
                {formatDuration(session.duration_secs)}
              </p>
              {session.ended_at === null && (
                <span className="text-xs text-emerald-500">Live</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
