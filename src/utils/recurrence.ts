import { addDays, parseDate, toDateKey } from './date.js'
import type { TaskRecurrence } from '../types/domain.js'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Last day of the given local month (1-12). Correctly accounts for leap years via Date's own rollover. */
function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

function addMonthsClamped(date: Date, months: number, dayOfMonth: number): Date {
  const targetMonthIndex = date.getMonth() + months
  const year = date.getFullYear() + Math.floor(targetMonthIndex / 12)
  const month0 = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = daysInMonth(year, month0 + 1)
  const day = Math.min(dayOfMonth, lastDay)
  return new Date(year, month0, day)
}

/**
 * Computes the next occurrence's due date (local "YYYY-MM-DD") from the date
 * just completed, or `null` if recurrence has ended (an explicit end date
 * has passed, or the rule is incomplete/invalid).
 *
 * Month-end policy: a monthly `dayOfMonth` that doesn't exist in the target
 * month (e.g. 31 in February, or 30 in February) clamps to that month's
 * last day — it never rolls over into the following month.
 */
export function computeNextDueDate(currentDueDate: string, recurrence: TaskRecurrence): string | null {
  const current = parseDate(currentDueDate)
  let next: Date

  switch (recurrence.frequency) {
    case 'daily': {
      next = addDays(current, 1)
      break
    }
    case 'weekly': {
      const weekdays = (recurrence.weekdays ?? []).filter((d) => d >= 0 && d <= 6)
      if (weekdays.length === 0) {
        // No explicit weekdays selected: repeat on the same weekday every week.
        next = addDays(current, 7)
        break
      }
      const sorted = [...new Set(weekdays)].sort((a, b) => a - b)
      let candidate = addDays(current, 1)
      // At most 7 days ahead guarantees finding the next matching weekday.
      for (let i = 0; i < 7; i++) {
        if (sorted.includes(candidate.getDay())) break
        candidate = addDays(candidate, 1)
      }
      next = candidate
      break
    }
    case 'monthly': {
      const dayOfMonth = recurrence.dayOfMonth
      if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return null
      next = addMonthsClamped(current, 1, dayOfMonth)
      break
    }
    default:
      return null
  }

  if (recurrence.endDate) {
    const end = parseDate(recurrence.endDate)
    if (next > end) return null
  }

  return toDateKey(next)
}

/** Human-readable summary for badges/labels, e.g. "Repeats weekly on Mon, Wed". */
export function describeRecurrence(recurrence: TaskRecurrence): string {
  switch (recurrence.frequency) {
    case 'daily':
      return 'Repeats daily'
    case 'weekly': {
      const weekdays = recurrence.weekdays ?? []
      if (weekdays.length === 0) return 'Repeats weekly'
      const labels = [...new Set(weekdays)]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_LABELS[d])
        .join(', ')
      return `Repeats weekly on ${labels}`
    }
    case 'monthly':
      return `Repeats monthly on day ${recurrence.dayOfMonth ?? '?'}`
    default:
      return 'Repeats'
  }
}

/** True when a recurrence rule has enough information to ever produce a next occurrence. */
export function isRecurrenceConfigValid(recurrence: TaskRecurrence): boolean {
  if (recurrence.frequency === 'monthly') {
    return Boolean(recurrence.dayOfMonth && recurrence.dayOfMonth >= 1 && recurrence.dayOfMonth <= 31)
  }
  return true
}

export { WEEKDAY_LABELS }
