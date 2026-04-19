import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { formatDistanceToNow } from 'date-fns'

/**
 * Converts seconds to a human-readable duration string.
 * Examples: "3h 25m", "45m", "< 1m", "--"
 */
export function formatDuration(secs: number): string {
  if (secs === 0) return '--'
  if (secs < 60) return '< 1m'

  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

/**
 * Formats an ISO date string into a readable date.
 * - Today: "Today, 14:30"
 * - Yesterday: "Yesterday, 09:15"
 * - Otherwise: "Jan 5, 2026"
 */
export function formatDate(isoString: string): string {
  const date = parseISO(isoString)

  if (isToday(date)) {
    return `Today, ${format(date, 'HH:mm')}`
  }

  if (isYesterday(date)) {
    return `Yesterday, ${format(date, 'HH:mm')}`
  }

  return format(date, 'MMM d, yyyy')
}

/**
 * Formats an ISO date string as a relative time.
 * Examples: "5 minutes ago", "3 hours ago", "2 days ago"
 */
export function formatRelativeTime(isoString: string): string {
  const date = parseISO(isoString)
  return formatDistanceToNow(date, { addSuffix: true })
}
