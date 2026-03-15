interface StatItem {
  label: string
  value: string
}

interface StatBarProps {
  items: StatItem[]
}

export function StatBar({ items }: StatBarProps) {
  return (
    <div className="flex">
      {items.map((item, i) => (
        <div
          key={i}
          className="group flex-[25] border border-[#282828] py-[32px] pl-[40px] transition-colors duration-200 hover:bg-white"
        >
          <p
            className="text-[16px] text-white group-hover:text-black transition-colors duration-200"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
          >
            {item.label}
          </p>
          <p
            className="mt-[4px] text-[28px] text-white group-hover:text-black transition-colors duration-200"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}
