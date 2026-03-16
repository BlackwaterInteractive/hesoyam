'use client'

import { addDays, subDays, format, isSameDay } from 'date-fns'

interface CalendarDateNavProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
}

export function CalendarDateNav({ selectedDate, onDateChange }: CalendarDateNavProps) {
  const dates = Array.from({ length: 9 }, (_, i) => addDays(selectedDate, i - 4))

  return (
    <div className="flex items-center py-[32px]">
      {/* Left arrow */}
      <button
        onClick={() => onDateChange(subDays(selectedDate, 1))}
        className="flex shrink-0 items-center px-[40px] transition-colors"
        style={{ color: 'rgba(255,255,255,0.2)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 1L1 7L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dates */}
      <div className="flex flex-1 items-center justify-center gap-[48px]">
        {dates.map((date) => {
          const selected = isSameDay(date, selectedDate)
          const color = selected ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.2)'
          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateChange(date)}
              className="flex flex-col items-center gap-[4px] transition-opacity hover:opacity-60"
            >
              <span
                style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: '24px',
                  lineHeight: 1,
                  color,
                }}
              >
                {format(date, 'd')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: '16px',
                  lineHeight: 1,
                  color,
                  textTransform: 'uppercase',
                }}
              >
                {format(date, 'EEE')}
              </span>
            </button>
          )
        })}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => onDateChange(addDays(selectedDate, 1))}
        className="flex shrink-0 items-center px-[40px] transition-colors"
        style={{ color: 'rgba(255,255,255,0.2)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L7 7L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
