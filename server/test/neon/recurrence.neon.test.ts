/**
 * Proves the recurring-task completion idempotency guarantee
 * (server/repositories/tasks.ts's completeTask) against REAL concurrent
 * requests on REAL Postgres — the one thing pg-mem could not verify
 * (confirmed in the V1.1 audit: pg-mem does not serialize concurrent
 * transactions on the same key, so a `Promise.all` of several
 * completeTask calls against pg-mem produced multiple next occurrences
 * instead of one). Only reachable via `npm run test:neon`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { completeTask, createTask, listTasks } from '../../repositories/tasks.ts'
import {
  TEST_RUN_MARKER,
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
  const user = await createNeonTestUser(sql, 'recurrence')
  userId = user.id
  console.log(`[neon test] recurrence.neon.test.ts using test user ${userId} (${user.email})`)
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

const CONCURRENT_REQUESTS = 10
const REPETITIONS = 5

describe('completeTask — concurrent duplicate-prevention on real Postgres', () => {
  for (let run = 1; run <= REPETITIONS; run++) {
    it(`run ${run}/${REPETITIONS}: exactly one next occurrence is created under ${CONCURRENT_REQUESTS} concurrent completions`, async () => {
      const title = `${TEST_RUN_MARKER}-recurring-run${run}`
      const task = await createTask(sql, userId, {
        title,
        dueDate: '2026-03-10',
        recurrence: { frequency: 'daily' },
      })

      const results = await Promise.all(
        Array.from({ length: CONCURRENT_REQUESTS }, () => completeTask(sql, userId, task.id)),
      )

      // Exactly one of the N concurrent callers actually generated the next occurrence.
      const generatedCount = results.filter((r) => r.nextOccurrence).length
      expect(generatedCount).toBe(1)

      // The database agrees: exactly one row claims this task as its parent.
      const all = await listTasks(sql, userId)
      const nextOccurrences = all.filter((t) => t.recurrenceParentId === task.id)
      expect(nextOccurrences).toHaveLength(1)
      expect(nextOccurrences[0].dueDate).toBe('2026-03-11')
      expect(nextOccurrences[0].status).toBe('todo')

      // The original occurrence is completed and its history preserved
      // (not mutated into the next occurrence).
      const original = all.find((t) => t.id === task.id)
      expect(original?.status).toBe('done')
      expect(original?.completedAt).toBeTruthy()
      expect(original?.dueDate).toBe('2026-03-10')
      expect(original?.title).toBe(title)

      // listTasks() itself is scoped to `userId` (server/repositories/tasks.ts),
      // so every row found above already belongs to the test user by
      // construction — no separate assertion needed to prove that.
    })
  }

  it('also prevents duplicates when completions race in smaller overlapping bursts', async () => {
    // A different concurrency shape than a single Promise.all of N: two
    // bursts of 5, started with a tiny stagger, to perturb timing
    // differently than the uniform-burst runs above.
    const title = `${TEST_RUN_MARKER}-recurring-staggered`
    const task = await createTask(sql, userId, {
      title,
      dueDate: '2026-04-01',
      recurrence: { frequency: 'weekly', weekdays: [1, 3, 5] },
    })

    const burstA = Promise.all(Array.from({ length: 5 }, () => completeTask(sql, userId, task.id)))
    await new Promise((resolve) => setTimeout(resolve, 5))
    const burstB = Promise.all(Array.from({ length: 5 }, () => completeTask(sql, userId, task.id)))
    const [resultsA, resultsB] = await Promise.all([burstA, burstB])

    const generatedCount = [...resultsA, ...resultsB].filter((r) => r.nextOccurrence).length
    expect(generatedCount).toBe(1)

    const all = await listTasks(sql, userId)
    expect(all.filter((t) => t.recurrenceParentId === task.id)).toHaveLength(1)
  })
})
