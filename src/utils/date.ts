/**
 * Parses an ISO date string as a local date. Date-only strings ("YYYY-MM-DD",
 * as produced by <input type="date">) are parsed as local midnight rather
 * than UTC midnight, which avoids an off-by-one-day shift in timezones
 * behind UTC. Strings that already carry a time component parse as normal.
 */
export function parseDate(dateStr: string): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr)
  if (dateOnly) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(dateStr)
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isToday(dateStr: string): boolean {
  return isSameDay(parseDate(dateStr), new Date())
}

export function isOverdue(dateStr: string): boolean {
  const date = parseDate(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

export function formatFriendlyDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatShortDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function formatLongDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Formats a Date as a local "YYYY-MM-DD" key — never via toISOString, which shifts by timezone. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/**
 * Returns the Monday (local midnight) that starts the week containing `date`.
 * Weeks are simple Monday-anchored 7-day buckets, so this handles year
 * boundaries correctly without ISO week-number arithmetic.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diffToMonday)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Formats a Monday-start week key as a friendly "Jan 5 – Jan 11, 2026" range. */
export function formatWeekRange(weekStartKey: string): string {
  const start = parseDate(weekStartKey)
  const end = addDays(start, 6)
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

export function greetingForHour(date: Date): string {
  const hour = date.getHours()
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
