interface RecentPlayItem {
  coverUrl: string | null
  gameName: string
  developerName: string
  playtime: string
  playedDate: string
  playedTime: string
}

interface RecentPlaysProps {
  items: RecentPlayItem[]
}

export function RecentPlays({ items }: RecentPlaysProps) {
  return (
    <div className="group flex flex-[70] flex-col border border-[#282828] pl-[40px] pt-[32px] pr-[56px] pb-[32px] transition-colors duration-200 hover:bg-white">
      {items.map((item, i) => (
        <div key={i}>
          {/* Session row */}
          <div className="flex items-center">
            {/* Cover */}
            <div className="shrink-0" style={{ width: '24px', height: '35px' }}>
              {item.coverUrl ? (
                <img
                  src={item.coverUrl}
                  alt={item.gameName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[#282828] group-hover:bg-[#cccccc] transition-colors duration-200" />
              )}
            </div>

            {/* Name + Developer */}
            <div className="ml-[8px] min-w-0">
              <p
                className="truncate text-[14px] text-white group-hover:text-black transition-colors duration-200"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
              >
                {item.gameName}
              </p>
              <p
                className="mt-[4px] truncate text-[10px] uppercase tracking-[0.1em] text-white/40 group-hover:text-black/40 transition-colors duration-200"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
              >
                {item.developerName}
              </p>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Playtime */}
            <p
              className="shrink-0 text-[20px] text-white group-hover:text-black transition-colors duration-200"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
            >
              {item.playtime}
            </p>

            {/* Date + Time */}
            <div className="ml-[16px] shrink-0 text-right">
              <p
                className="text-[10px] text-white/40 group-hover:text-black/40 transition-colors duration-200"
                style={{ fontFamily: 'Satoshi', fontWeight: 400 }}
              >
                {item.playedDate}
              </p>
              <p
                className="text-[10px] text-white/40 group-hover:text-black/40 transition-colors duration-200"
                style={{ fontFamily: 'Satoshi', fontWeight: 400 }}
              >
                {item.playedTime}
              </p>
            </div>
          </div>

          {/* Dashed separator (not after last item) */}
          {i < items.length - 1 && (
            <div className="mt-[6px] mb-[8px] border-t border-dashed border-[#282828] group-hover:border-[#cccccc] transition-colors duration-200" />
          )}
        </div>
      ))}
    </div>
  )
}
