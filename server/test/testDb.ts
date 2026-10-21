import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { newDb } from 'pg-mem'
import type { SqlPool } from '../db.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, '..', '..', 'db', 'migrations')

/**
 * A fresh in-memory Postgres (pg-mem), schema applied from every real
 * migration file in db/migrations, in order — so these tests exercise the
 * actual SQL that would run against Neon, not a hand-simplified stand-in,
 * without needing a live database or any credentials. Every test gets its
 * own isolated instance (see beforeEach in each test file), so tests never
 * leak state into each other. pg-mem's `pg` adapter implements `.connect()`
 * the same way real `pg`/`@neondatabase/serverless` does (verified
 * empirically), so withTransaction()'s dedicated-connection code path is
 * exercised here exactly as it runs in production.
 */
export async function createMigratedTestSql(): Promise<SqlPool> {
  const db = newDb({ autoCreateForeignKeyIndices: true })
  const { Pool } = db.adapters.createPg()
  const pool = new Pool() as unknown as SqlPool
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const migration = readFileSync(path.join(migrationsDir, file), 'utf8')
    await pool.query(migration)
  }
  return pool
}
