/**
 * Proves server/db.ts's withTransaction() against the REAL
 * @neondatabase/serverless driver (Pool.connect() + WebSocket), not
 * pg-mem. Only reachable via `npm run test:neon` — see
 * server/test/neon/run.mjs and README.md.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { withTransaction } from '../../db.ts'
import { createTask, getTask, listTasks } from '../../repositories/tasks.ts'
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
  const user = await createNeonTestUser(sql, 'transactions')
  userId = user.id
  console.log(`[neon test] transaction.neon.test.ts using test user ${userId} (${user.email})`)
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

describe('withTransaction — real Postgres session semantics', () => {
  it('BEGIN, statements, and COMMIT execute on the same backend/session', async () => {
    const pids = await withTransaction(sql, async (tx) => {
      const first = await tx.query<{ pid: number }>('select pg_backend_pid() as pid')
      const second = await tx.query<{ pid: number }>('select pg_backend_pid() as pid')
      return [first.rows[0].pid, second.rows[0].pid]
    })
    // If BEGIN/statements/COMMIT could land on different pooled
    // connections (exactly the bug this withTransaction rewrite fixed),
    // these would differ.
    expect(pids[0]).toBe(pids[1])
    expect(pids[0]).toBeGreaterThan(0)
  })

  it('commits a real write visible in a subsequent, separate query', async () => {
    const title = `${TEST_RUN_MARKER}-commit-check`
    const created = await withTransaction(sql, async (tx) => {
      return createTask(tx, userId, { title, dueDate: '2026-03-10' })
    })
    const fetched = await getTask(sql, userId, created.id)
    expect(fetched?.title).toBe(title)
  })

  it('a deliberate error inside the transaction rolls back, leaving no partial writes', async () => {
    const before = await listTasks(sql, userId)
    const beforeCount = before.length

    const title = `${TEST_RUN_MARKER}-should-not-persist`
    await expect(
      withTransaction(sql, async (tx) => {
        await createTask(tx, userId, { title, dueDate: '2026-03-10' })
        // A real statement error on the SAME connection, inside the same
        // transaction — not a thrown JS error that never touched Postgres.
        await tx.query('select 1 / 0')
      }),
    ).rejects.toThrow()

    const after = await listTasks(sql, userId)
    expect(after.length).toBe(beforeCount)
    expect(after.find((t) => t.title === title)).toBeUndefined()
  })

  it('releases the connection back to the pool even when the transaction throws', async () => {
    // Fire several transactions that each deliberately fail, back to back.
    // If a connection were ever leaked (not released on the throw path),
    // this would eventually hang or exhaust the pool instead of completing.
    for (let i = 0; i < 5; i++) {
      await expect(
        withTransaction(sql, async (tx) => {
          await tx.query('select 1')
          throw new Error(`deliberate failure ${i}`)
        }),
      ).rejects.toThrow(`deliberate failure ${i}`)
    }
    // The pool is still usable afterward — proves prior connections came back.
    const result = await sql.query<{ ok: number }>('select 1 as ok')
    expect(result.rows[0].ok).toBe(1)
  })

  it('runs multiple transactions concurrently without cross-talk (each sees its own uncommitted state only)', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        withTransaction(sql, async (tx) => {
          const title = `${TEST_RUN_MARKER}-concurrent-${i}`
          const task = await createTask(tx, userId, { title, dueDate: '2026-03-10' })
          // Read back within the same transaction/connection.
          const self = await getTask(tx, userId, task.id)
          return { title, selfTitle: self?.title }
        }),
      ),
    )
    for (const r of results) {
      expect(r.selfTitle).toBe(r.title)
    }
    const all = await listTasks(sql, userId)
    for (const r of results) {
      expect(all.some((t) => t.title === r.title)).toBe(true)
    }
  })
})
