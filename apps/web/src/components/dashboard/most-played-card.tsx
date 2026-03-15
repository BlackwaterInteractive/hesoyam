interface MostPlayedCardProps {
  label: string
  gameName: string
  playtime: string
}

export function MostPlayedCard({ label, gameName, playtime }: MostPlayedCardProps) {
  return (
    <div className="group flex items-end justify-between border border-[#282828] py-[32px] pl-[40px] pr-[80px] transition-colors duration-200 hover:bg-white">
      <div>
        <p
          className="text-[16px] text-white group-hover:text-black transition-colors duration-200"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
        >
          {label}
        </p>
        <p
          className="mt-[4px] text-[28px] text-white group-hover:text-black transition-colors duration-200"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
        >
          {gameName}
        </p>
      </div>
      <p
        className="text-[28px] text-white group-hover:text-black transition-colors duration-200"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
      >
        {playtime}
      </p>
    </div>
  )
}
