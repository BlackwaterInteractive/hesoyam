interface DevNoteCardProps {
  title: string
  subtitle: string
  ctaLabel: string
  ctaHref?: string
}

export function DevNoteCard({ title, subtitle, ctaLabel, ctaHref = '#' }: DevNoteCardProps) {
  return (
    <div className="group flex flex-[30] flex-col border border-[#282828] pl-[40px] pt-[32px] pr-[40px] pb-[32px] transition-colors duration-200 hover:bg-white">
      <p
        className="text-[24px] text-white group-hover:text-black transition-colors duration-200"
        style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}
      >
        {title}
      </p>
      <p
        className="mt-[12px] text-[16px] text-white/40 group-hover:text-black/40 transition-colors duration-200"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
      >
        {subtitle}
      </p>
      <div className="mt-[24px]">
        <a
          href={ctaHref}
          className="inline-block bg-white px-[16px] py-[6px] text-[14px] text-black group-hover:bg-black group-hover:text-white transition-colors duration-200"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  )
}
