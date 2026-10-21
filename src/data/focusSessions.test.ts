import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { focusSessionsRepo } from './focusSessions'
import { clearDemoData, seedDemoData } from './demoData'
import { notesRepo } from './notes'
import { projectsRepo } from './projects'
import { tasksRepo } from './tasks'
import { computeElapsedMs } from '../utils/focusTimer'

async function clearAllRecords() {
  const [sessions, projects, tasks, notes] = await Promise.all([
    focusSessionsRepo.list(),
    projectsRepo.list(),
    tasksRepo.list(),
    notesRepo.list(),
  ])
  await Promise.all([
    focusSessionsRepo.removeMany(sessions.map((s) => s.id)),
    projectsRepo.removeMany(projects.map((p) => p.id)),
    tasksRepo.removeMany(tasks.map((t) => t.id)),
    notesRepo.removeMany(notes.map((n) => n.id)),
  ])
}

beforeEach(async () => {
  // Only Date is faked — setTimeout/microtasks stay real so IndexedDB's
  // internal scheduling (via fake-indexeddb) is never blocked.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-01-05T09:00:00.000Z'))
  await clearAllRecords()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('focusSessionsRepo timer state machine', () => {
  it('starts a session as active with zero accumulated time', async () => {
    const session = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    expect(session.status).toBe('active')
    expect(session.accumulatedMs).toBe(0)
    expect(session.durationMinutes).toBe(0)
    expect(session.resumedAt).toBe(session.startedAt)
  })

  it('pauses a session, freezing its accumulated elapsed time', async () => {
    const session = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    vi.setSystemTime(new Date('2026-01-05T09:05:00.000Z'))
    const paused = await focusSessionsRepo.pause(session.id)
    expect(paused.status).toBe('paused')
    expect(computeElapsedMs(paused)).toBe(5 * 60_000)

    // Time passing while paused must not count toward elapsed time.
    vi.setSystemTime(new Date('2026-01-05T09:30:00.000Z'))
    expect(computeElapsedMs(paused)).toBe(5 * 60_000)
  })

  it('resumes a paused session and continues accumulating from where it left off', async () => {
    const session = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    vi.setSystemTime(new Date('2026-01-05T09:05:00.000Z'))
    await focusSessionsRepo.pause(session.id)
    vi.setSystemTime(new Date('2026-01-05T09:20:00.000Z')) // 15 min paused, ignored
    const resumed = await focusSessionsRepo.resume(session.id)
    expect(resumed.status).toBe('active')
    vi.setSystemTime(new Date('2026-01-05T09:23:00.000Z')) // +3 min active
    expect(computeElapsedMs(resumed)).toBe(8 * 60_000)
  })

  it('completes naturally exactly once, recording the actual elapsed duration', async () => {
    const session = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    vi.setSystemTime(new Date('2026-01-05T09:25:00.000Z'))
    const completed = await focusSessionsRepo.complete(session.id)
    expect(completed.status).toBe('completed')
    expect(completed.durationMinutes).toBe(25)
    expect(completed.endedAt).toBeTruthy()

    // A second completion call (e.g. a duplicate timer tick) must be a no-op.
    vi.setSystemTime(new Date('2026-01-05T09:40:00.000Z'))
    const completedAgain = await focusSessionsRepo.complete(session.id)
    expect(completedAgain.durationMinutes).toBe(25)
    expect(completedAgain.updatedAt).toBe(completed.updatedAt)
  })

  it('ends a session early and marks it interrupted with the actual elapsed time', async () => {
    const session = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    vi.setSystemTime(new Date('2026-01-05T09:10:00.000Z'))
    const ended = await focusSessionsRepo.endEarly(session.id)
    expect(ended.status).toBe('interrupted')
    expect(ended.durationMinutes).toBe(10)
    expect(ended.endedAt).toBeTruthy()

    // endEarly after already-terminal is also a no-op.
    vi.setSystemTime(new Date('2026-01-05T09:50:00.000Z'))
    const again = await focusSessionsRepo.endEarly(session.id)
    expect(again.durationMinutes).toBe(10)
    expect(again.updatedAt).toBe(ended.updatedAt)
  })

  it('resolves a concurrent complete()/endEarly() race without a split-brain status', async () => {
    // Regression test: complete()/endEarly() each used to read, check, and
    // write via two SEPARATE read-then-write round trips (an outer read for
    // the terminal-state guard, then another independent read inside the
    // shared update() helper). A concurrent call could interleave between
    // those two reads, pass the stale guard check, and silently overwrite
    // the other call's already-committed terminal status — so the caller's
    // returned object could say 'completed' while storage actually held
    // 'interrupted' (or vice versa). Both methods now read-check-write in a
    // single IndexedDB transaction, which IndexedDB serializes against any
    // other transaction on the same store, closing the race.
    const session = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    vi.setSystemTime(new Date('2026-01-05T09:12:00.000Z'))

    const [completeResult, endEarlyResult] = await Promise.all([
      focusSessionsRepo.complete(session.id),
      focusSessionsRepo.endEarly(session.id),
    ])

    const stored = await focusSessionsRepo.get(session.id)
    // Whichever call's transaction committed first determines the outcome,
    // but all three views of the record must agree — no split-brain state.
    expect(completeResult.status).toBe(stored?.status)
    expect(endEarlyResult.status).toBe(stored?.status)
    expect(['completed', 'interrupted']).toContain(stored?.status)
    // The loser must not have clobbered the winner's duration/timestamps.
    expect(completeResult.durationMinutes).toBe(stored?.durationMinutes)
    expect(endEarlyResult.durationMinutes).toBe(stored?.durationMinutes)
  })

  it('recovers a running session after refresh from persisted timestamps alone', async () => {
    const session = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    vi.setSystemTime(new Date('2026-01-05T09:12:00.000Z'))
    // Simulate "refresh" by re-fetching fresh rather than reusing the in-memory object.
    const reloaded = await focusSessionsRepo.get(session.id)
    expect(reloaded?.status).toBe('active')
    expect(computeElapsedMs(reloaded!)).toBe(12 * 60_000)
  })

  it('recovers a paused session after refresh with its frozen elapsed time intact', async () => {
    const session = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    vi.setSystemTime(new Date('2026-01-05T09:07:00.000Z'))
    await focusSessionsRepo.pause(session.id)
    vi.setSystemTime(new Date('2026-01-05T11:00:00.000Z')) // long gap, e.g. browser closed
    const reloaded = await focusSessionsRepo.get(session.id)
    expect(reloaded?.status).toBe('paused')
    expect(computeElapsedMs(reloaded!)).toBe(7 * 60_000)
  })

  it('tags break sessions distinctly from focus sessions so they never inflate focus totals', async () => {
    const breakSession = await focusSessionsRepo.start({ type: 'short-break', plannedDurationMinutes: 5 })
    vi.setSystemTime(new Date('2026-01-05T09:05:00.000Z'))
    const completed = await focusSessionsRepo.complete(breakSession.id)
    expect(completed.type).toBe('short-break')
    expect(completed.durationMinutes).toBe(5)
  })

  it('associates a session with a project and task, and keeps the link after reload', async () => {
    const project = await projectsRepo.create({ name: 'Deep work project' })
    const task = await tasksRepo.create({ title: 'Write the draft', projectId: project.id })
    const session = await focusSessionsRepo.start({
      type: 'focus',
      plannedDurationMinutes: 25,
      projectId: project.id,
      taskId: task.id,
    })
    const reloaded = await focusSessionsRepo.get(session.id)
    expect(reloaded?.projectId).toBe(project.id)
    expect(reloaded?.taskId).toBe(task.id)
  })

  it('preserves a completed session with its projectId cleared when the project is deleted', async () => {
    const project = await projectsRepo.create({ name: 'Short-lived project' })
    const session = await focusSessionsRepo.start({
      type: 'focus',
      plannedDurationMinutes: 25,
      projectId: project.id,
    })
    vi.setSystemTime(new Date('2026-01-05T09:25:00.000Z'))
    await focusSessionsRepo.complete(session.id)

    await projectsRepo.deletePreservingRecords(project.id)

    const survivor = await focusSessionsRepo.get(session.id)
    expect(survivor).toBeDefined()
    expect(survivor?.projectId).toBeUndefined()
    expect(survivor?.status).toBe('completed')
    expect(survivor?.durationMinutes).toBe(25)
  })
})

describe('demo data isolation', () => {
  it('removing demo data never deletes real focus sessions', async () => {
    const real = await focusSessionsRepo.create({ durationMinutes: 20 })
    await seedDemoData()

    const beforeClear = await focusSessionsRepo.list()
    expect(beforeClear.length).toBeGreaterThan(1)

    await clearDemoData()

    const remaining = await focusSessionsRepo.list()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(real.id)
    expect(remaining[0].isDemo).toBeFalsy()
  })
})
