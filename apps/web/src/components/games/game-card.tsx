'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { formatDuration, cn } from '@/lib/utils'
import type { Game, UserGame, UserGameLibrary, GameStatus } from '@/lib/types'

interface GameCardProps {
  game: Game
  userGame: UserGame | null
  libraryEntry: UserGameLibrary
  isCurrentlyPlaying?: boolean
}

const STATUS_CONFIG: Record<GameStatus, { label: string; color: string }> = {
  want_to_play: { label: 'Want to Play', color: 'border-blue-700 bg-blue-950 text-blue-400' },
  played: { label: 'Played', color: 'border-zinc-600 bg-zinc-800 text-zinc-300' },
  completed: { label: 'Completed', color: 'border-green-700 bg-green-950 text-green-400' },
}

export function GameCard({ game, userGame, libraryEntry, isCurrentlyPlaying }: GameCardProps) {
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
            {isCurrentlyPlaying ? (
              <span className="border border-emerald-700 bg-emerald-950 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                Playing
              </span>
            ) : (
              <span className={cn('border px-2 py-0.5 text-[10px] font-medium', statusInfo.color)}>
                {statusInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 space-y-2">
          <h3 className="truncate text-base font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
            {game.name}
          </h3>
          {game.developer && (
            <p className="truncate text-xs text-zinc-500">{game.developer}</p>
          )}

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
