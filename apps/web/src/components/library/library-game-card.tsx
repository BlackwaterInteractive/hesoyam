import Link from 'next/link'
import { formatDuration } from '@/lib/utils'
import type { Game, UserGame, UserGameLibrary, GameStatus } from '@/lib/types'

interface LibraryGameCardProps {
  game: Game
  userGame: UserGame | null
  libraryEntry: UserGameLibrary
}

const STATUS_CONFIG: Record<GameStatus, { label: string; bg: string; text: string }> = {
  want_to_play: { label: 'Want to Play', bg: '#F5C518', text: '#000000' },
  played:       { label: 'Played',       bg: '#FFFFFF',  text: '#000000' },
  completed:    { label: 'Completed',    bg: '#2563EB',  text: '#FFFFFF' },
}

export function LibraryGameCard({ game, userGame, libraryEntry }: LibraryGameCardProps) {
  const status = STATUS_CONFIG[libraryEntry.status as GameStatus]

  return (
    <Link href={`/games/${game.id}`} className="group block w-full overflow-hidden">
      {/* Cover — 176:240 aspect ratio with 2px white border */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '176/240', border: '2px solid white', boxSizing: 'border-box' }}
      >
        {/* Inner wrapper: clips image zoom + tag slide */}
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

          {/* Status tag — slides up from bottom on hover */}
          <div
            className="absolute bottom-[12px] left-1/2 -translate-x-1/2 whitespace-nowrap px-[10px] py-[3px] text-[10px]"
            style={{
              backgroundColor: status.bg,
              color: status.text,
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
            }}
          >
            {status.label}
          </div>
        </div>

        {/* Arrow — on outer div so it touches the white border, slides down from top */}
        <div className="absolute right-0 top-0 -translate-y-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <img src="/icons/ic_game_card_arrow.svg" width={31} height={31} alt="" />
        </div>
      </div>

      {/* Details — name + developer */}
      <div className="bg-white px-[10px] pb-[8px] pt-[6px]">
        <p
          className="truncate text-[12px] text-black"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
        >
          {game.name}
        </p>
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

      {/* Gameplay details */}
      <div className="bg-white px-[10px] pb-[8px] pt-[16px] text-center">
        {userGame && userGame.total_time_secs > 0 ? (
          <p
            className="text-[10px] text-black"
            style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}
          >
            <span style={{ fontWeight: 700 }}>{formatDuration(userGame.total_time_secs)}</span>
            {' '}of playtime
          </p>
        ) : (
          <p
            className="text-[10px] text-[#595959]"
            style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}
          >
            Gameplay haven't tracked yet!
          </p>
        )}
      </div>

      {/* Bill / receipt bottom edge */}
      <svg width="100%" height="12" viewBox="0 0 180 12" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
        <path d="M180 12H171.998C171.947 9.83497 170.177 8.0957 168 8.0957C165.823 8.0957 164.053 9.83497 164.002 12H159.999C159.974 9.8128 158.193 8.04785 156 8.04785C153.807 8.04785 152.026 9.8128 152.001 12H147.999C147.974 9.8128 146.193 8.04785 144 8.04785C141.807 8.04785 140.026 9.8128 140.001 12H135.999C135.974 9.8128 134.193 8.04785 132 8.04785C129.807 8.04785 128.026 9.8128 128.001 12H123.999C123.974 9.8128 122.193 8.04785 120 8.04785C117.807 8.04785 116.026 9.8128 116.001 12H111.999C111.974 9.8128 110.193 8.04785 108 8.04785C105.807 8.04785 104.026 9.8128 104.001 12H99.999C99.9735 9.8128 98.1932 8.04785 96 8.04785C93.8068 8.04785 92.0265 9.8128 92.001 12H87.999C87.9735 9.8128 86.1932 8.04785 84 8.04785C81.8068 8.04785 80.0265 9.8128 80.001 12H75.999C75.9735 9.8128 74.1932 8.04785 72 8.04785C69.8068 8.04785 68.0265 9.8128 68.001 12H63.999C63.9735 9.8128 62.1932 8.04785 60 8.04785C57.8068 8.04785 56.0265 9.8128 56.001 12H51.999C51.9735 9.8128 50.1932 8.04785 48 8.04785C45.8068 8.04785 44.0265 9.8128 44.001 12H39.999C39.9735 9.8128 38.1932 8.04785 36 8.04785C33.8068 8.04785 32.0265 9.8128 32.001 12H27.999C27.9735 9.8128 26.1932 8.04785 24 8.04785C21.8068 8.04785 20.0265 9.8128 20.001 12H16C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12H0V0H180V12Z" fill="white"/>
      </svg>

    </Link>
  )
}
