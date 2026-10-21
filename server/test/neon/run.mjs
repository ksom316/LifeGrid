#!/usr/bin/env node
// Launcher for the real-PostgreSQL integration suite (server/test/neon/**).
// This is the ONLY supported way to run those tests — it is the single
// place that gates on DATABASE_URL actually being set, prints which
// database is about to be used (host + database name only — never the
// username, password, or full connection string) so that's visible BEFORE
// any test can write anything, and sets the explicit opt-in flag the test
// files themselves also require (so even a direct
// `vitest run --config vitest.neon.config.ts` without going through this
// script still refuses to run).
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error(
    [
      'DATABASE_URL is not set — refusing to run the real-PostgreSQL integration suite.',
      '',
      'This suite runs real writes (and cleans them up afterward) against whatever',
      'database DATABASE_URL points at, so it only runs when you have deliberately',
      'pointed it at a disposable database. See README.md "Real-PostgreSQL',
      'integration tests" for the exact setup steps (create a disposable Neon',
      'branch, apply migrations to it, then set DATABASE_URL to THAT branch).',
    ].join('\n'),
  )
  process.exit(1)
}

let parsed
try {
  parsed = new URL(databaseUrl)
} catch {
  console.error('DATABASE_URL is not a valid connection URL. Refusing to run.')
  process.exit(1)
}

// Only ever print what's needed to recognize the target, never credentials.
console.log('Real-PostgreSQL integration suite — target database:')
console.log(`  host:     ${parsed.hostname}`)
console.log(`  database: ${parsed.pathname.replace(/^\//, '') || '(default)'}`)
console.log(
  'If this is not the disposable test branch you intended, press Ctrl+C now — tests start in 3 seconds.',
)
console.log('')

await new Promise((resolve) => setTimeout(resolve, 3000))

// Resolve and invoke vitest's own CLI entry script directly with the
// current Node executable (`process.execPath`), instead of shelling out to
// the `npx`/`npx.cmd` wrapper. child_process.spawn on Windows cannot
// execute a `.cmd` file as a direct target without `shell: true` — it's a
// batch script, not a native executable, so Windows' CreateProcess (which
// Node calls without a shell by default) rejects it outright with
// `spawn EINVAL`. Invoking `node <resolved path to vitest's JS entry point>`
// is a plain child process running a real ESM script, so it needs no shell
// and works identically on Windows, macOS, and Linux. The path is resolved
// from this project's actually-installed `vitest` package (via its own
// package.json `bin` field), never hardcoded or guessed.
const require = createRequire(import.meta.url)
const vitestPkgPath = require.resolve('vitest/package.json')
const vitestPkg = require('vitest/package.json')
const vitestBinRelative = typeof vitestPkg.bin === 'string' ? vitestPkg.bin : vitestPkg.bin?.vitest
if (!vitestBinRelative) {
  console.error('Could not determine vitest\'s CLI entry point from its package.json "bin" field.')
  process.exit(1)
}
const vitestEntry = path.join(path.dirname(vitestPkgPath), vitestBinRelative)
if (!existsSync(vitestEntry)) {
  console.error(`Resolved vitest CLI entry does not exist on disk: ${vitestEntry}`)
  process.exit(1)
}

const configPath = fileURLToPath(new URL('../../../vitest.neon.config.ts', import.meta.url))

const child = spawn(process.execPath, [vitestEntry, 'run', '--config', configPath], {
  stdio: 'inherit',
  env: { ...process.env, CONFIRM_NEON_INTEGRATION: 'yes' },
})

child.on('error', (err) => {
  console.error('Failed to launch the integration test process:', err)
  process.exit(1)
})
child.on('exit', (code) => process.exit(code ?? 1))
