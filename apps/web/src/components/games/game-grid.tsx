'use client'

import { useState, useMemo } from 'react'
import { GameCard } from './game-card'
import { GameSearchModal } from './game-search-modal'
import type { Game, UserGame, UserGameLibrary, GameStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface GameWithStats {
  game: Game
  userGame: UserGame | null
  libraryEntry: UserGameLibrary
}

interface GameGridProps {
  games: GameWithStats[]
  statusCounts: Record<GameStatus, number>
  libraryGameIds: string[]
  currentlyPlayingGameIds: Set<string>
}

const STATUS_TABS: { value: GameStatus; label: string }[] = [
  { value: 'played', label: 'Played' },
  { value: 'completed', label: 'Completed' },
  { value: 'want_to_play', label: 'Want to Play' },
]

type SortOption = 'last_played' | 'name' | 'added' | 'most_played'

const TAB_SORT_OPTIONS: Record<GameStatus, { value: SortOption; label: string }[]> = {
  want_to_play: [
    { value: 'added', label: 'Last Added' },
    { value: 'name', label: 'Name A-Z' },
  ],
  played: [
    { value: 'last_played', label: 'Last Played' },
    { value: 'added', label: 'Last Added' },
    { value: 'name', label: 'Name A-Z' },
    { value: 'most_played', label: 'Most Played' },
  ],
  completed: [
    { value: 'added', label: 'Last Added' },
    { value: 'name', label: 'Name A-Z' },
    { value: 'most_played', label: 'Most Played' },
  ],
}

const TAB_DEFAULT_SORT: Record<GameStatus, SortOption> = {
  want_to_play: 'added',
  played: 'last_played',
  completed: 'added',
}

export function GameGrid({ games, statusCounts, libraryGameIds, currentlyPlayingGameIds }: GameGridProps) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<GameStatus>('played')
  const [sort, setSort] = useState<SortOption>('last_played')
  const [modalOpen, setModalOpen] = useState(false)

  const libraryGameIdSet = useMemo(() => new Set(libraryGameIds), [libraryGameIds])

  function handleTabChange(tab: GameStatus) {
    setActiveTab(tab)
    setSort(TAB_DEFAULT_SORT[tab])
  }

  const sortOptions = TAB_SORT_OPTIONS[activeTab]

  const filtered = useMemo(() => {
    let result = games.filter((g) => g.libraryEntry.status === activeTab)

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        ({ game }) =>
          game.name.toLowerCase().includes(q) ||
          (game.developer && game.developer.toLowerCase().includes(q)) ||
          game.genres?.some((g) => g.toLowerCase().includes(q))
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sort) {
        case 'last_played':
          const aLast = a.userGame?.last_played ?? ''
          const bLast = b.userGame?.last_played ?? ''
          return bLast.localeCompare(aLast)
        case 'name':
          return a.game.name.localeCompare(b.game.name)
        case 'most_played':
          return (b.userGame?.total_time_secs ?? 0) - (a.userGame?.total_time_secs ?? 0)
        case 'added':
        default:
          return b.libraryEntry.added_at.localeCompare(a.libraryEntry.added_at)
      }
    })

    return result
  }, [games, search, activeTab, sort])

  return (
    <div>
      {/* Status tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.value
                ? 'border border-emerald-600 bg-emerald-950 text-emerald-400'
                : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-60">{statusCounts[tab.value]}</span>
          </button>
        ))}
      </div>

      {/* Search + sort bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search games by name, developer, or genre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-zinc-800 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-300 outline-none focus:border-emerald-500/50"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 border border-emerald-700 bg-emerald-950 px-4 py-3 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-900"
        >
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Game
        </button>
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
          {filtered.map(({ game, userGame, libraryEntry }) => (
            <GameCard
              key={game.id}
              game={game}
              userGame={userGame}
              libraryEntry={libraryEntry}
              isCurrentlyPlaying={currentlyPlayingGameIds.has(game.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border border-zinc-800 bg-zinc-900 py-20">
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
              d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z"
            />
          </svg>
          {search.trim() ? (
            <p className="text-zinc-400">No games match your search.</p>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold text-zinc-300">
                No games in this category
              </h2>
              <p className="mb-4 max-w-sm text-center text-sm text-zinc-500">
                {activeTab === 'want_to_play'
                  ? 'Add games you want to play using the search above.'
                  : activeTab === 'played'
                    ? 'Start tracking games via Discord or the desktop agent to see them here.'
                    : 'Mark games as completed from their detail page.'}
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="border border-emerald-700 bg-emerald-950 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-900"
              >
                + Add a Game
              </button>
            </>
          )}
        </div>
      )}

      <GameSearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        libraryGameIds={libraryGameIdSet}
      />
    </div>
  )
}
