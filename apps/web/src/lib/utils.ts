import clsx, { type ClassValue } from 'clsx'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'

/**
 * Merge class names using clsx.
 */
export function cn(...classes: ClassValue[]) {
  return clsx(...classes)
}

/**
 * Format a duration in seconds to a human-readable string.
 * Returns "Xh Ym" for durations >= 1 hour, "Xm" for shorter durations,
 * and "<1m" for durations under 60 seconds.
 */
export function formatDuration(secs: number): string {
  if (secs < 0) secs = 0
  if (secs < 60) return '--'

  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  return `${minutes}m`
}

/**
 * Format an ISO date string to a human-friendly date.
 * Shows "Today", "Yesterday", or a formatted date for older entries.
 */
export function formatDate(date: string): string {
  const d = new Date(date)

  if (isToday(d)) {
    return `Today, ${format(d, 'h:mm a')}`
  }

  if (isYesterday(d)) {
    return `Yesterday, ${format(d, 'h:mm a')}`
  }

  return format(d, 'MMM d, yyyy')
}

/**
 * Format an ISO date string to a relative time string (e.g. "3 hours ago").
 */
export function formatRelativeTime(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}
