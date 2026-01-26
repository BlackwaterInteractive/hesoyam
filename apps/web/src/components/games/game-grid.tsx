'use client'

import { useState, useMemo } from 'react'
import { GameCard } from './game-card'
import type { Game, UserGame } from '@/lib/types'

export interface GameWithStats {
  game: Game
  userGame: UserGame
}

interface GameGridProps {
  games: GameWithStats[]
}

export function GameGrid({ games }: GameGridProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return games
    const q = search.toLowerCase()
    return games.filter(
      ({ game }) =>
        game.name.toLowerCase().includes(q) ||
        (game.developer && game.developer.toLowerCase().includes(q)) ||
        game.genres.some((g) => g.toLowerCase().includes(q))
    )
  }, [games, search])

  return (
    <div>
      {/* Search / filter bar */}
      <div className="mb-8">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search games by name, developer, or genre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
      </div>

      {/* Results count */}
      {search.trim() && (
        <p className="mb-4 text-sm text-zinc-500">
          {filtered.length} {filtered.length === 1 ? 'game' : 'games'} found
        </p>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(({ game, userGame }) => (
            <GameCard key={game.id} game={game} userGame={userGame} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 py-20">
          <svg
            className="mb-4 h-12 w-12 text-zinc-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <p className="text-zinc-400">No games match your search.</p>
        </div>
      )}
    </div>
  )
}
