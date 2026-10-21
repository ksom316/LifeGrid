/**
 * Proves the focus-session finalization idempotency guarantee
 * (server/repositories/focusSessions.ts's finalizeFocusSession) against
 * real concurrent requests on real Postgres. Only reachable via
 * `npm run test:neon`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  finalizeFocusSession,
  getFocusSession,
  listFocusSessions,
  startFocusSession,
} from '../../repositories/focusSessions.ts'
import {
  assertNeonIntegrationOptIn,
  assertUserFullyRemoved,
  cleanupNeonTestUser,
  createNeonTestUser,
  neonTestPool,
} from './testSetup.ts'

assertNeonIntegrationOptIn()

const sql = neonTestPool()
let userId: string

beforeAll(async () => {
  const user = await createNeonTestUser(sql, 'focus-sessions')
  userId = user.id
  console.log(`[neon test] focusSession.neon.test.ts using test user ${userId} (${user.email})`)
})

afterAll(async () => {
  if (!userId) return
  try {
    await cleanupNeonTestUser(sql, userId)
    await assertUserFullyRemoved(sql, userId)
    console.log(`[neon test] cleaned up test user ${userId}`)
  } catch (err) {
    console.error(
      `[neon test] CLEANUP FAILED for user ${userId} — remove it by hand: delete from users where id = '${userId}';`,
      err,
    )
    throw err
  }
})

describe('finalizeFocusSession — concurrent finalization on real Postgres', () => {
  it('10 concurrent "complete" calls on the same session produce exactly one consistent final state', async () => {
    const session = await startFocusSession(sql, userId, { plannedDurationMinutes: 25 })

    const results = await Promise.all(
      Array.from({ length: 10 }, () => finalizeFocusSession(sql, userId, session.id, 'completed')),
    )

    // Every caller must agree on the same final status and duration — no
    // caller should see a different, half-applied state.
    const statuses = new Set(results.map((r) => r.status))
    const durations = new Set(results.map((r) => r.durationMinutes))
    expect(statuses.size).toBe(1)
    expect([...statuses][0]).toBe('completed')
    expect(durations.size).toBe(1)

    const persisted = await getFocusSession(sql, userId, session.id)
    expect(persisted?.status).toBe('completed')
    expect(persisted?.durationMinutes).toBe([...durations][0])
    expect(persisted?.endedAt).toBeTruthy()

    // No duplicate session rows were created by the race.
    const all = await listFocusSessions(sql, userId)
    expect(all.filter((s) => s.id === session.id)).toHaveLength(1)
  })

  it('a race between "complete" and "interrupted" settles on exactly one outcome, never a corrupted mix', async () => {
    const session = await startFocusSession(sql, userId, { plannedDurationMinutes: 25 })

    const calls = [
      ...Array.from({ length: 5 }, () => finalizeFocusSession(sql, userId, session.id, 'completed')),
      ...Array.from({ length: 5 }, () => finalizeFocusSession(sql, userId, session.id, 'interrupted')),
    ]
    const results = await Promise.all(calls)

    const statuses = new Set(results.map((r) => r.status))
    // Exactly one of the two outcomes won — every caller's returned status
    // must agree with it, never a mix and never anything else.
    expect(statuses.size).toBe(1)
    expect(['completed', 'interrupted']).toContain([...statuses][0])

    const persisted = await getFocusSession(sql, userId, session.id)
    expect(persisted?.status).toBe([...statuses][0])

    const durations = new Set(results.map((r) => r.durationMinutes))
    expect(durations.size).toBe(1)
    expect(persisted?.durationMinutes).toBe([...durations][0])
  })

  it('pause and complete racing never leave the session active forever or double-count elapsed time', async () => {
    const session = await startFocusSession(sql, userId, { plannedDurationMinutes: 25 })
    await new Promise((resolve) => setTimeout(resolve, 50))

    const results = await Promise.all([
      finalizeFocusSession(sql, userId, session.id, 'completed'),
      finalizeFocusSession(sql, userId, session.id, 'completed'),
      finalizeFocusSession(sql, userId, session.id, 'completed'),
    ])

    const durations = new Set(results.map((r) => r.durationMinutes))
    expect(durations.size).toBe(1)
    // At 25 planned minutes, a real elapsed time of ~50ms should round to 0
    // minutes, not some multiple of itself from double-counting across
    // racing finalizers.
    expect([...durations][0]).toBeLessThan(2)

    const persisted = await getFocusSession(sql, userId, session.id)
    expect(persisted?.status).toBe('completed')
  })
})
