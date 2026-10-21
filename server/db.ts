import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// @neondatabase/serverless's Pool.query() sends each query as an
// independent HTTP request — fast, but explicitly documented as NOT
// supporting sessions or transactions ("you can only send one query at a
// time this way"). Session/transaction support requires Pool.connect(),
// which needs a WebSocket implementation in Node.js (Node has no global
// WebSocket before v22, and Vercel's configured Node runtime version isn't
// guaranteed to be v22+), so one is always configured explicitly here
// rather than assuming the deployment target's Node version.
neonConfig.webSocketConstructor = ws

/**
 * The minimal query surface every repository depends on. The real
 * production pool, a checked-out transactional connection, and the
 * `pg-mem` in-memory Postgres used by the test suite all implement this
 * same node-postgres-compatible `query(text, params)` shape, so repository
 * code never needs to know which one it's talking to.
 */
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>
}

export interface SqlConnection extends Sql {
  release(): void
}

/**
 * What `getPool()` returns: plain `.query()` for one-shot statements (no
 * WebSocket needed, lowest latency), plus `.connect()` for the handful of
 * operations that need a real session — multi-statement transactions and
 * `SELECT ... FOR UPDATE` locks, neither of which mean anything if each
 * statement could land on a different underlying connection.
 */
export interface SqlPool extends Sql {
  connect(): Promise<SqlConnection>
}

let pool: Pool | null = null
let testPoolOverride: SqlPool | null = null

/**
 * Lazily creates the shared connection pool from DATABASE_URL. Vercel
 * Functions reuse a warm module scope across invocations on the same
 * instance, so this amortizes pool creation the same way a long-running
 * server would, without ever being created at module-import time (which
 * would crash local type-checking / bundling in any environment that
 * doesn't have DATABASE_URL set, e.g. the frontend build).
 */
export function getPool(): SqlPool {
  if (testPoolOverride) return testPoolOverride
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured.')
    }
    pool = new Pool({ connectionString })
  }
  return pool as unknown as SqlPool
}

/**
 * Test-only seam: lets the API-handler test suite point every handler at an
 * isolated pg-mem instance instead of a real Neon connection, without
 * changing any handler's code or signature. Never called outside test setup
 * — production always takes the DATABASE_URL branch above. pg-mem's `pg`
 * adapter implements `.connect()`/`.release()` the same way real `pg` does,
 * confirmed empirically, so the same withTransaction() code path is
 * exercised in tests as in production.
 */
export function __setTestPool(sql: SqlPool | null): void {
  testPoolOverride = sql
}

/**
 * Runs `fn` inside a single Postgres transaction on one dedicated
 * connection (BEGIN/COMMIT/ROLLBACK) — never on the bare pool, whose
 * `.query()` calls are independent HTTP requests with no guaranteed
 * connection affinity between them. The connection is always released back
 * to the pool, even on error.
 */
export async function withTransaction<T>(pool: SqlPool, fn: (tx: Sql) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    try {
      const result = await fn(client)
      await client.query('commit')
      return result
    } catch (err) {
      await client.query('rollback').catch(() => {
        // Best-effort: if the connection is already broken the rollback
        // itself may fail, but the original error is what matters.
      })
      throw err
    }
  } finally {
    client.release()
  }
}
