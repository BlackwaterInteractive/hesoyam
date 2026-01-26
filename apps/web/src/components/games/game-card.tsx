'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { formatDuration } from '@/lib/utils'
import type { Game, UserGame } from '@/lib/types'

interface GameCardProps {
  game: Game
  userGame: UserGame
}

export function GameCard({ game, userGame }: GameCardProps) {
  const initial = game.name.charAt(0).toUpperCase()

  return (
    <Link href={`/games/${game.id}`}>
      <div className="group cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all duration-200 hover:scale-[1.02] hover:border-zinc-700 hover:bg-zinc-800/80">
        {/* Cover image */}
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg">
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
        </div>

        {/* Info */}
        <div className="mt-4 space-y-2">
          <h3 className="truncate text-base font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
            {game.name}
          </h3>

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
        </div>
      </div>
    </Link>
  )
}
