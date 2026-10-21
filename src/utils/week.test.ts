import { describe, expect, it } from 'vitest'
import { getWeekStart, toDateKey } from './date'

describe('getWeekStart', () => {
  it('returns the same Monday for any day within that week', () => {
    // Mon 2026-01-05 through Sun 2026-01-11
    const monday = toDateKey(getWeekStart(new Date(2026, 0, 5)))
    const wednesday = toDateKey(getWeekStart(new Date(2026, 0, 7)))
    const sunday = toDateKey(getWeekStart(new Date(2026, 0, 11)))
    expect(monday).toBe('2026-01-05')
    expect(wednesday).toBe('2026-01-05')
    expect(sunday).toBe('2026-01-05')
  })

  it('handles a year boundary correctly', () => {
    // Thursday 2026-01-01 falls in the week starting Monday 2025-12-29.
    const key = toDateKey(getWeekStart(new Date(2026, 0, 1)))
    expect(key).toBe('2025-12-29')
  })

  it('handles the following week crossing back into the new year', () => {
    const key = toDateKey(getWeekStart(new Date(2026, 0, 5)))
    expect(key).toBe('2026-01-05')
  })
})
