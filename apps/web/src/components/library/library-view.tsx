'use client'

import { useState, useMemo } from 'react'
import { LibraryTabBar, type LibraryTab } from './library-tab-bar'
import { LibraryGameCard } from './library-game-card'
import type { GameWithStats } from '@/components/games/game-grid'

interface LibraryViewProps {
  games: GameWithStats[]
}

export function LibraryView({ games }: LibraryViewProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>('all')

  const filtered = useMemo(() => {
    if (activeTab === 'all') return games
    return games.filter((g) => g.libraryEntry.status === activeTab)
  }, [games, activeTab])

  return (
    <div>
      <LibraryTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSearchClick={() => {}}
      />

      <div className="pl-[40px] pr-[40px] pt-[40px]">
        <div
          className="grid gap-x-[16px] gap-y-[32px]"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(176px, 1fr))' }}
        >
          {filtered.map(({ game, userGame, libraryEntry }) => (
            <LibraryGameCard
              key={game.id}
              game={game}
              userGame={userGame}
              libraryEntry={libraryEntry}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
