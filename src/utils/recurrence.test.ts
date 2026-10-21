import { describe, expect, it } from 'vitest'
import { computeNextDueDate, describeRecurrence, isRecurrenceConfigValid } from './recurrence'
import type { TaskRecurrence } from '../types/domain'

describe('computeNextDueDate — daily', () => {
  it('advances by exactly one day', () => {
    expect(computeNextDueDate('2026-03-10', { frequency: 'daily' })).toBe('2026-03-11')
  })

  it('crosses a month boundary', () => {
    expect(computeNextDueDate('2026-03-31', { frequency: 'daily' })).toBe('2026-04-01')
  })

  it('crosses a year boundary', () => {
    expect(computeNextDueDate('2025-12-31', { frequency: 'daily' })).toBe('2026-01-01')
  })
})

describe('computeNextDueDate — weekly', () => {
  it('falls back to the same weekday next week when no weekdays are selected', () => {
    // 2026-03-10 is a Tuesday.
    expect(computeNextDueDate('2026-03-10', { frequency: 'weekly' })).toBe('2026-03-17')
  })

  it('finds the next selected weekday later in the same week', () => {
    // Tuesday (2) -> next selected day is Thursday (4), same week.
    const recurrence: TaskRecurrence = { frequency: 'weekly', weekdays: [1, 4] } // Mon, Thu
    expect(computeNextDueDate('2026-03-10', recurrence)).toBe('2026-03-12') // Thursday
  })

  it('wraps to the following week when no selected weekday remains in the current week', () => {
    // Friday (5), only Mon/Tue selected -> wraps to next Monday.
    const recurrence: TaskRecurrence = { frequency: 'weekly', weekdays: [1, 2] }
    expect(computeNextDueDate('2026-03-13', recurrence)).toBe('2026-03-16') // Monday
  })

  it('handles a single selected weekday matching the due date itself (recurs next week)', () => {
    // 2026-03-10 is a Tuesday; only Tuesday selected.
    const recurrence: TaskRecurrence = { frequency: 'weekly', weekdays: [2] }
    expect(computeNextDueDate('2026-03-10', recurrence)).toBe('2026-03-17')
  })
})

describe('computeNextDueDate — monthly', () => {
  it('advances to the same day next month', () => {
    expect(computeNextDueDate('2026-01-15', { frequency: 'monthly', dayOfMonth: 15 })).toBe('2026-02-15')
  })

  it('clamps to the last day of a shorter month (31st in a 30-day month)', () => {
    expect(computeNextDueDate('2026-01-31', { frequency: 'monthly', dayOfMonth: 31 })).toBe('2026-02-28')
  })

  it('clamps day 29 to Feb 28 in a non-leap year', () => {
    // 2026 is not a leap year.
    expect(computeNextDueDate('2026-01-29', { frequency: 'monthly', dayOfMonth: 29 })).toBe('2026-02-28')
  })

  it('keeps day 29 in Feb during a leap year', () => {
    // 2028 is a leap year.
    expect(computeNextDueDate('2028-01-29', { frequency: 'monthly', dayOfMonth: 29 })).toBe('2028-02-29')
  })

  it('crosses a year boundary (December into January)', () => {
    expect(computeNextDueDate('2026-12-15', { frequency: 'monthly', dayOfMonth: 15 })).toBe('2027-01-15')
  })

  it('returns null when dayOfMonth is missing or out of range', () => {
    expect(computeNextDueDate('2026-01-15', { frequency: 'monthly' })).toBeNull()
    expect(computeNextDueDate('2026-01-15', { frequency: 'monthly', dayOfMonth: 0 })).toBeNull()
    expect(computeNextDueDate('2026-01-15', { frequency: 'monthly', dayOfMonth: 32 })).toBeNull()
  })
})

describe('computeNextDueDate — end date and disabled recurrence', () => {
  it('returns the next date when it falls on or before the end date', () => {
    const recurrence: TaskRecurrence = { frequency: 'daily', endDate: '2026-03-11' }
    expect(computeNextDueDate('2026-03-10', recurrence)).toBe('2026-03-11')
  })

  it('returns null once the next occurrence would fall after the end date', () => {
    const recurrence: TaskRecurrence = { frequency: 'daily', endDate: '2026-03-10' }
    expect(computeNextDueDate('2026-03-10', recurrence)).toBeNull()
  })

  it('respects the end date for weekly recurrence', () => {
    const recurrence: TaskRecurrence = { frequency: 'weekly', endDate: '2026-03-16' }
    expect(computeNextDueDate('2026-03-10', recurrence)).toBeNull() // next would be 03-17
  })

  it('respects the end date for monthly recurrence', () => {
    const recurrence: TaskRecurrence = { frequency: 'monthly', dayOfMonth: 15, endDate: '2026-02-01' }
    expect(computeNextDueDate('2026-01-15', recurrence)).toBeNull() // next would be 02-15
  })
})

describe('describeRecurrence', () => {
  it('describes daily recurrence', () => {
    expect(describeRecurrence({ frequency: 'daily' })).toBe('Repeats daily')
  })

  it('describes weekly recurrence with selected days in order', () => {
    expect(describeRecurrence({ frequency: 'weekly', weekdays: [3, 1] })).toBe('Repeats weekly on Mon, Wed')
  })

  it('describes weekly recurrence with no selected days', () => {
    expect(describeRecurrence({ frequency: 'weekly' })).toBe('Repeats weekly')
  })

  it('describes monthly recurrence', () => {
    expect(describeRecurrence({ frequency: 'monthly', dayOfMonth: 5 })).toBe('Repeats monthly on day 5')
  })
})

describe('isRecurrenceConfigValid', () => {
  it('accepts daily and weekly without extra fields', () => {
    expect(isRecurrenceConfigValid({ frequency: 'daily' })).toBe(true)
    expect(isRecurrenceConfigValid({ frequency: 'weekly' })).toBe(true)
  })

  it('requires a valid dayOfMonth for monthly', () => {
    expect(isRecurrenceConfigValid({ frequency: 'monthly', dayOfMonth: 15 })).toBe(true)
    expect(isRecurrenceConfigValid({ frequency: 'monthly' })).toBe(false)
    expect(isRecurrenceConfigValid({ frequency: 'monthly', dayOfMonth: 0 })).toBe(false)
    expect(isRecurrenceConfigValid({ frequency: 'monthly', dayOfMonth: 32 })).toBe(false)
  })
})
