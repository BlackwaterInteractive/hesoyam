'use client'

import { usePathname, useRouter } from 'next/navigation'

export function DashboardHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const isGames = pathname === '/games' || pathname.startsWith('/games/')

  return (
    <div className="flex h-[112px] w-full shrink-0 items-center justify-end border-b border-[#282828] pr-[40px]">
      {isGames && (
        <button
          onClick={() => router.push('/games?addGame=true')}
          className="bg-white px-[16px] py-[8px] text-[12px] text-black"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
        >
          Add new game
        </button>
      )}
    </div>
  )
}
