'use client'

import { cn } from '@/lib/utils'

export type LibraryTab = 'all' | 'want_to_play' | 'completed' | 'played'

const TABS: { value: LibraryTab; label: string }[] = [
  { value: 'all', label: 'All games' },
  { value: 'want_to_play', label: 'Want to play' },
  { value: 'completed', label: 'Completed' },
  { value: 'played', label: 'Played' },
]

interface LibraryTabBarProps {
  activeTab: LibraryTab
  onTabChange: (tab: LibraryTab) => void
  onSearchClick: () => void
}

export function LibraryTabBar({ activeTab, onTabChange, onSearchClick }: LibraryTabBarProps) {
  return (
    <div className="sticky top-0 z-10 flex border-b border-[#282828] bg-[#111111]">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            'shrink-0 border-r border-t border-[#282828] px-[40px] py-[16px] text-[16px] transition-colors duration-200',
            activeTab === tab.value
              ? 'bg-[#282828] text-white'
              : 'text-[#595959] hover:text-white'
          )}
          style={{ fontFamily: 'var(--font-body)', fontWeight: 500 }}
        >
          {tab.label}
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <button
        onClick={onSearchClick}
        className="flex shrink-0 items-center border-l border-t border-[#282828] pl-[40px] pr-[40px] py-[16px] text-[16px] text-[#595959] transition-colors duration-200 hover:text-white"
        style={{ fontFamily: 'var(--font-body)', fontWeight: 500 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="ml-[8px]">Search</span>
        <span className="ml-[96px]">⌘/</span>
      </button>
    </div>
  )
}
