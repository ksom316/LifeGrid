import { randomUUID } from 'node:crypto'
import { getPool } from '../../db.ts'
import type { SqlPool } from '../../db.ts'
import { createUser } from '../../repositories/users.ts'
import { hashPassword } from '../../auth.ts'

/**
 * Both gates server/test/neon/run.mjs sets before invoking vitest, checked
 * again here so a direct `vitest run --config vitest.neon.config.ts`
 * (bypassing the launcher) still refuses to run rather than silently
 * connecting to whatever DATABASE_URL happens to be set to.
 */
export function assertNeonIntegrationOptIn(): void {
  if (process.env.CONFIRM_NEON_INTEGRATION !== 'yes' || !process.env.DATABASE_URL) {
    throw new Error(
      'Real-PostgreSQL integration tests must be run via "npm run test:neon", not directly — see README.md.',
    )
  }
}

/** Every record this suite creates carries this in a title/email so a human skimming the database can recognize it, even if automated cleanup ever fails. */
export const TEST_RUN_MARKER = `NEON-INTEGRATION-TEST-${Date.now()}-${randomUUID().slice(0, 8)}`

export function uniqueTestEmail(label: string): string {
  return `${TEST_RUN_MARKER.toLowerCase()}-${label}@life-grid-integration-test.invalid`
}

export interface NeonTestUser {
  id: string
  email: string
}

/** Creates one real, uniquely-identified user for a test file to scope all its records under. Deleting this user (see cleanupNeonTestUser) cascades to every row it owns — the only cleanup a test needs to do. */
export async function createNeonTestUser(sql: SqlPool, label: string): Promise<NeonTestUser> {
  const email = uniqueTestEmail(label)
  const passwordHash = await hashPassword(`${TEST_RUN_MARKER}-not-a-real-password`)
  const user = await createUser(sql, email, passwordHash)
  return { id: user.id, email: user.email }
}

/**
 * Deletes exactly the given test user (by id) via a plain `DELETE ... WHERE
 * id = $1` — never a table-wide delete, truncate, or anything matching more
 * than one row. `users.id` has `on delete cascade` from every owned table
 * (db/migrations/0001_init.sql), so this alone removes every project,
 * task, note, focus session, daily plan, weekly review, and session row
 * the test created. If this throws, the caller's test must report the
 * user's id/email so it can be found and removed by hand.
 */
export async function cleanupNeonTestUser(sql: SqlPool, userId: string): Promise<void> {
  await sql.query('delete from users where id = $1', [userId])
}

/** Confirms the test user (and, by cascade, everything it owned) is actually gone — used as an assertion, not just a best-effort cleanup call. */
export async function assertUserFullyRemoved(sql: SqlPool, userId: string): Promise<void> {
  const { rows } = await sql.query('select 1 from users where id = $1', [userId])
  if (rows.length > 0) {
    throw new Error(`Cleanup failed to remove test user ${userId} — remove it by hand.`)
  }
}

let sharedPool: SqlPool | null = null

/** The real production pool (server/db.ts's getPool()), not pg-mem — the whole point of this suite. */
export function neonTestPool(): SqlPool {
  if (!sharedPool) sharedPool = getPool()
  return sharedPool
}
