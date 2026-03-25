'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { formatDuration } from '@/lib/utils'
import type { Game } from '@/lib/types'

interface CalendarGameCardProps {
  game: Game
  sessionCount: number
  dayPlaytimeSecs: number
  allTimePlaytimeSecs: number | null
  showViewDetails?: boolean
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-[12px] text-[#595959]"
        style={{ fontFamily: 'var(--font-body)', fontWeight: 300 }}
      >
        {label}
      </span>
      <span
        className="text-[12px] text-black"
        style={{ fontFamily: 'var(--font-body)', fontWeight: 500 }}
      >
        {value}
      </span>
    </div>
  )
}

function MarqueeText({
  text,
  hovered,
  className,
  style,
}: {
  text: string
  hovered: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [offset, setOffset] = useState(0)

  const prevHovered = useRef(false)
  if (hovered && !prevHovered.current) {
    if (containerRef.current && textRef.current) {
      const overflow = textRef.current.scrollWidth - containerRef.current.clientWidth
      if (overflow > 0) setOffset(-overflow)
    }
  } else if (!hovered && prevHovered.current) {
    setOffset(0)
  }
  prevHovered.current = hovered

  return (
    <div ref={containerRef} className="overflow-hidden">
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap ${className ?? ''}`}
        style={{
          ...style,
          transform: `translateX(${offset}px)`,
          transition: hovered
            ? `transform ${Math.abs(offset) / 40}s linear`
            : 'transform 0.3s ease',
        }}
      >
        {text}
      </span>
    </div>
  )
}

export function CalendarGameCard({
  game,
  sessionCount,
  dayPlaytimeSecs,
  allTimePlaytimeSecs,
  showViewDetails = false,
}: CalendarGameCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={`/games/${game.id}`}
      className="group block w-full overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Cover — same as library card */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '176/240', border: '2px solid white', boxSizing: 'border-box' }}
      >
        <div className="relative h-full w-full overflow-hidden">
          {game.cover_url ? (
            <img
              src={game.cover_url}
              alt={game.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-[#282828]" />
          )}
        </div>

        {/* Arrow — slides down from top on hover */}
        <div className="absolute right-0 top-0 -translate-y-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <img src="/icons/ic_game_card_arrow.svg" width={31} height={31} alt="" />
        </div>
      </div>

      {/* Game name + developer */}
      <div className="bg-white px-[10px] pb-[8px] pt-[6px]">
        <MarqueeText
          text={game.name}
          hovered={hovered}
          className="text-[12px] text-black"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
        />
        <p
          className="mt-[4px] truncate text-[10px] uppercase text-[#595959]"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
        >
          {game.developer ?? game.publisher ?? '--'}
        </p>
      </div>

      {/* Dashed separator */}
      <div
        className="mx-[10px] bg-white"
        style={{ borderTop: '1px dashed rgba(17,17,17,0.2)' }}
      />

      {/* Stats */}
      <div className="flex flex-col gap-[6px] bg-white px-[10px] pb-[8px] pt-[10px]">
        <StatRow label="Sessions" value={String(sessionCount)} />
        <StatRow label="Day playtime" value={formatDuration(dayPlaytimeSecs)} />
        {allTimePlaytimeSecs !== null && (
          <StatRow label="All time playtime" value={formatDuration(allTimePlaytimeSecs)} />
        )}
      </div>

      {/* View Details */}
      {showViewDetails && (
        <div className="bg-white px-[10px] pb-[8px] text-right">
          <span
            className="text-[10px] text-black underline"
            style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}
          >
            View Details
          </span>
        </div>
      )}

      {/* Bill / receipt bottom edge */}
      <svg width="100%" height="12" viewBox="0 0 180 12" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
        <path d="M180 12H171.998C171.947 9.83497 170.177 8.0957 168 8.0957C165.823 8.0957 164.053 9.83497 164.002 12H159.999C159.974 9.8128 158.193 8.04785 156 8.04785C153.807 8.04785 152.026 9.8128 152.001 12H147.999C147.974 9.8128 146.193 8.04785 144 8.04785C141.807 8.04785 140.026 9.8128 140.001 12H135.999C135.974 9.8128 134.193 8.04785 132 8.04785C129.807 8.04785 128.026 9.8128 128.001 12H123.999C123.974 9.8128 122.193 8.04785 120 8.04785C117.807 8.04785 116.026 9.8128 116.001 12H111.999C111.974 9.8128 110.193 8.04785 108 8.04785C105.807 8.04785 104.026 9.8128 104.001 12H99.999C99.9735 9.8128 98.1932 8.04785 96 8.04785C93.8068 8.04785 92.0265 9.8128 92.001 12H87.999C87.9735 9.8128 86.1932 8.04785 84 8.04785C81.8068 8.04785 80.0265 9.8128 80.001 12H75.999C75.9735 9.8128 74.1932 8.04785 72 8.04785C69.8068 8.04785 68.0265 9.8128 68.001 12H63.999C63.9735 9.8128 62.1932 8.04785 60 8.04785C57.8068 8.04785 56.0265 9.8128 56.001 12H51.999C51.9735 9.8128 50.1932 8.04785 48 8.04785C45.8068 8.04785 44.0265 9.8128 44.001 12H39.999C39.9735 9.8128 38.1932 8.04785 36 8.04785C33.8068 8.04785 32.0265 9.8128 32.001 12H27.999C27.9735 9.8128 26.1932 8.04785 24 8.04785C21.8068 8.04785 20.0265 9.8128 20.001 12H16C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12H0V0H180V12Z" fill="white"/>
      </svg>
    </Link>
  )
}
