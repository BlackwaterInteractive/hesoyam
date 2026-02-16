import { formatDuration } from '@/lib/utils'
import type { Game, UserGame } from '@/lib/types'

export interface TopGameEntry {
  game: Game
  userGame: UserGame
}

interface TopGamesListProps {
  games: TopGameEntry[]
}

export function TopGamesList({ games }: TopGamesListProps) {
  if (games.length === 0) {
    return (
      <div className="border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-sm text-zinc-400">No games tracked yet.</p>
      </div>
    )
  }

  return (
    <div className="border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-200">Top Games</h2>
      </div>
      <ul className="divide-y divide-zinc-800">
        {games.map((entry, index) => (
          <li key={entry.game.id} className="flex items-center gap-4 px-4 py-3">
            {/* Rank */}
            <span className="w-6 shrink-0 text-center text-sm font-medium text-zinc-500">
              #{index + 1}
            </span>

            {/* Cover */}
            {entry.game.cover_url ? (
              <img
                src={entry.game.cover_url}
                alt={entry.game.name}
                className="h-10 w-8 shrink-0 object-cover"
              />
            ) : (
              <div className="flex h-10 w-8 shrink-0 items-center justify-center bg-zinc-800">
                <span className="text-[10px] font-medium text-zinc-500">
                  {entry.game.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}

            {/* Game info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">
                {entry.game.name}
              </p>
              {entry.game.developer && (
                <p className="truncate text-xs text-zinc-500">
                  {entry.game.developer}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium text-zinc-200">
                {formatDuration(entry.userGame.total_time_secs)}
              </p>
              <p className="text-xs text-zinc-500">
                {entry.userGame.total_sessions} {entry.userGame.total_sessions === 1 ? 'session' : 'sessions'}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
