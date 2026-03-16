interface StreakDay {
  date: string
  day: string
  playtime: string | null
  status: 'tracked' | 'missed' | 'upcoming'
}

interface StreakCardProps {
  streakCount: number
  streakLabel: string
  days: StreakDay[]
}

export function StreakCard({ streakCount, streakLabel, days }: StreakCardProps) {
  return (
    <div className="group flex flex-[45] items-center border border-[#282828] pl-[40px] transition-colors duration-200 hover:bg-white">
      {/* Left: Streak number + label */}
      <div className="shrink-0">
        <p
          className="text-[68px] leading-none text-white group-hover:text-black transition-colors duration-200"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
        >
          {streakCount}
        </p>
        <p
          className="mt-[4px] text-[16px] text-white group-hover:text-black transition-colors duration-200"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
        >
          {streakLabel}
        </p>
      </div>

      {/* Right: Weekly breakdown */}
      <div className="ml-[40px] flex flex-col gap-[4px]">
        {days.map((day, i) => {
          const colorClass =
            day.status === 'tracked'
              ? 'text-[#FB6D91]'
              : day.status === 'missed'
              ? 'text-[#282828] group-hover:text-[#bbbbbb]'
              : 'text-[#555555]'

          return (
            <div
              key={i}
              className={`flex items-center text-[12px] uppercase transition-colors duration-200 ${colorClass}`}
              style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
            >
              <span className="w-[48px]">{day.date}</span>
              <span className="ml-[12px] w-[100px]">{day.day}</span>
              <span className="ml-[40px]">{day.playtime ?? '-'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
