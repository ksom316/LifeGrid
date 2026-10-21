#!/usr/bin/env node
// Applies every .sql file in db/migrations, in filename order, inside its own
// transaction, recording each one in a `_migrations` table so re-running this
// script is a no-op for migrations already applied. Requires DATABASE_URL to
// point at a real Postgres (e.g. a Neon connection string) — this script is
// never run automatically and never runs against a database it wasn't
// explicitly pointed at.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Client } from '@neondatabase/serverless'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, 'migrations')

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Point it at your Neon connection string before running migrations.')
    process.exit(1)
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const client = new Client(databaseUrl)
  await client.connect()
  try {
    await client.query(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `)

    const { rows: applied } = await client.query('select name from _migrations')
    const appliedNames = new Set(applied.map((r) => r.name))

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`skip  ${file} (already applied)`)
        continue
      }
      const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
      console.log(`apply ${file}`)
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query('insert into _migrations (name) values ($1)', [file])
        await client.query('commit')
      } catch (err) {
        await client.query('rollback')
        throw new Error(`Migration ${file} failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    console.log('done')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
