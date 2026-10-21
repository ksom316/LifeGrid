import { describe, expect, it } from 'vitest'
import { computeFocusStats } from './focusStats'
import type { FocusSession } from '../types/domain'

let counter = 0
function makeSession(overrides: Partial<FocusSession>): FocusSession {
  counter += 1
  return {
    id: overrides.id ?? `session-${counter}`,
    startedAt: '2026-01-05T10:00:00.000Z',
    durationMinutes: 25,
    note: '',
    type: 'focus',
    status: 'completed',
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-05T10:00:00.000Z',
    ...overrides,
  }
}

describe('computeFocusStats', () => {
  it('sums today and this-week minutes using local calendar boundaries', () => {
    // "Now" is Wednesday 2026-01-07 local time; the week starts Monday 2026-01-05.
    const now = new Date(2026, 0, 7, 15, 0, 0)
    const sessions = [
      makeSession({ startedAt: new Date(2026, 0, 7, 9, 0, 0).toISOString(), durationMinutes: 30 }), // today
      makeSession({ startedAt: new Date(2026, 0, 5, 9, 0, 0).toISOString(), durationMinutes: 20 }), // earlier this week
      makeSession({ startedAt: new Date(2025, 11, 29, 9, 0, 0).toISOString(), durationMinutes: 99 }), // last week — excluded
    ]
    const stats = computeFocusStats(sessions, now)
    expect(stats.todayMinutes).toBe(30)
    expect(stats.weekMinutes).toBe(50)
  })

  it('excludes break sessions from all focus totals', () => {
    const now = new Date(2026, 0, 7, 15, 0, 0)
    const sessions = [
      makeSession({ startedAt: new Date(2026, 0, 7, 9, 0, 0).toISOString(), durationMinutes: 25, type: 'focus' }),
      makeSession({ startedAt: new Date(2026, 0, 7, 10, 0, 0).toISOString(), durationMinutes: 5, type: 'short-break' }),
      makeSession({ startedAt: new Date(2026, 0, 7, 11, 0, 0).toISOString(), durationMinutes: 15, type: 'long-break' }),
    ]
    const stats = computeFocusStats(sessions, now)
    expect(stats.todayMinutes).toBe(25)
    expect(stats.completedCount).toBe(1)
  })

  it('excludes interrupted and still-active sessions from completed totals', () => {
    const now = new Date(2026, 0, 7, 15, 0, 0)
    const sessions = [
      makeSession({ startedAt: new Date(2026, 0, 7, 9, 0, 0).toISOString(), durationMinutes: 25, status: 'completed' }),
      makeSession({ startedAt: new Date(2026, 0, 7, 10, 0, 0).toISOString(), durationMinutes: 8, status: 'interrupted' }),
      makeSession({ startedAt: new Date(2026, 0, 7, 11, 0, 0).toISOString(), durationMinutes: 0, status: 'active' }),
    ]
    const stats = computeFocusStats(sessions, now)
    expect(stats.todayMinutes).toBe(25)
    expect(stats.completedCount).toBe(1)
  })

  it('computes average duration and per-project totals', () => {
    const now = new Date(2026, 0, 7, 15, 0, 0)
    const sessions = [
      makeSession({ startedAt: new Date(2026, 0, 7, 9, 0, 0).toISOString(), durationMinutes: 20, projectId: 'p1' }),
      makeSession({ startedAt: new Date(2026, 0, 7, 10, 0, 0).toISOString(), durationMinutes: 40, projectId: 'p1' }),
      makeSession({ startedAt: new Date(2026, 0, 7, 11, 0, 0).toISOString(), durationMinutes: 30, projectId: 'p2' }),
    ]
    const stats = computeFocusStats(sessions, now)
    expect(stats.averageMinutes).toBe(30)
    expect(stats.byProject).toEqual([
      { projectId: 'p1', minutes: 60 },
      { projectId: 'p2', minutes: 30 },
    ])
  })

  it('returns zeroed stats for no sessions', () => {
    const stats = computeFocusStats([])
    expect(stats).toEqual({ todayMinutes: 0, weekMinutes: 0, completedCount: 0, averageMinutes: 0, byProject: [] })
  })
})
