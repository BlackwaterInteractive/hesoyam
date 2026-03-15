interface GameplayCardProps {
  status: string
  gameName: string
  subtitle: string
  playtime: string
  coverUrl: string | null
  glowStatus?: 'live' | 'grace' | 'none'
}

export function GameplayCard({
  status,
  gameName,
  subtitle,
  playtime,
  coverUrl,
  glowStatus = 'none',
}: GameplayCardProps) {
  const dotColor =
    glowStatus === 'live' ? 'bg-green-500' : 'bg-orange-400'
  const pingColor =
    glowStatus === 'live' ? 'bg-green-400' : 'bg-orange-300'

  return (
    <div className="group flex flex-[55] min-w-0 overflow-hidden border border-[#282828] pb-[32px] pl-[40px] pt-[30px] transition-colors duration-200 hover:bg-white">
      {/* Game Cover */}
      <div className="shrink-0" style={{ width: '97.38px', height: '132px' }}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={gameName}
            className="h-full w-full object-cover"
            style={{ border: '1px solid #FFFFFF' }}
          />
        ) : (
          <div
            className="h-full w-full bg-[#282828] group-hover:bg-[#cccccc] transition-colors duration-200"
            style={{ border: '1px solid #FFFFFF' }}
          />
        )}
      </div>

      {/* Text Section */}
      <div className="ml-[16px] flex min-w-0 flex-1 flex-col justify-between pr-[56px]">
        {/* Top: Status + Game Name */}
        <div className="min-w-0">
          <div className="flex items-center gap-[8px]">
            <p
              className="text-[16px] text-white group-hover:text-black transition-colors duration-200"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
            >
              {status}
            </p>
            {/* Live indicator dot */}
            {glowStatus !== 'none' && (
              <span className="relative flex h-3 w-3 shrink-0">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${pingColor} opacity-75`} />
                <span className={`relative inline-flex h-3 w-3 rounded-full ${dotColor}`} />
              </span>
            )}
          </div>
          <p
            className="mt-[4px] truncate text-[28px] text-white group-hover:text-black transition-colors duration-200"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
          >
            {gameName}
          </p>
        </div>

        {/* Bottom: Subtitle + Playtime */}
        <div>
          <p
            className="text-[16px] text-white group-hover:text-black transition-colors duration-200"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
          >
            {subtitle}
          </p>
          <p
            className="mt-[4px] text-[28px] text-white group-hover:text-black transition-colors duration-200"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
          >
            {playtime}
          </p>
        </div>
      </div>
    </div>
  )
}
