'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { formatDuration, cn } from '@/lib/utils'
import type { Game, UserGame, UserGameLibrary, GameStatus } from '@/lib/types'

interface GameCardProps {
  game: Game
  userGame: UserGame | null
  libraryEntry: UserGameLibrary
}

const STATUS_CONFIG: Record<GameStatus, { label: string; color: string }> = {
  playing: { label: 'Playing', color: 'border-emerald-700 bg-emerald-950 text-emerald-400' },
  completed: { label: 'Completed', color: 'border-green-700 bg-green-950 text-green-400' },
  want_to_play: { label: 'Want to Play', color: 'border-blue-700 bg-blue-950 text-blue-400' },
  dropped: { label: 'Dropped', color: 'border-red-700 bg-red-950 text-red-400' },
  shelved: { label: 'Shelved', color: 'border-amber-700 bg-amber-950 text-amber-400' },
}

export function GameCard({ game, userGame, libraryEntry }: GameCardProps) {
  const initial = game.name.charAt(0).toUpperCase()
  const statusInfo = STATUS_CONFIG[libraryEntry.status as GameStatus]

  return (
    <Link href={`/games/${game.id}`}>
      <div className="group cursor-pointer border border-zinc-800 bg-zinc-900 p-4 transition-all duration-200 hover:scale-[1.02] hover:border-zinc-700 hover:bg-zinc-800/80">
        {/* Cover image */}
        <div className="relative aspect-[3/4] w-full overflow-hidden">
          {game.cover_url ? (
            <img
              src={game.cover_url}
              alt={game.name}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-900">
              <span className="text-5xl font-bold text-white/80">
                {initial}
              </span>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute left-2 top-2">
            <span className={cn('border px-2 py-0.5 text-[10px] font-medium', statusInfo.color)}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 space-y-2">
          <h3 className="truncate text-base font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
            {game.name}
          </h3>

          {userGame ? (
            <>
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>{formatDuration(userGame.total_time_secs)}</span>
                <span>
                  {userGame.total_sessions}{' '}
                  {userGame.total_sessions === 1 ? 'session' : 'sessions'}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Last played{' '}
                {formatDistanceToNow(new Date(userGame.last_played), {
                  addSuffix: true,
                })}
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">No playtime tracked</p>
          )}
        </div>
      </div>
    </Link>
  )
}
