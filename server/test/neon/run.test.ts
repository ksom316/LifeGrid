/**
 * Regression tests for server/test/neon/run.mjs's own launcher mechanics —
 * no database involved, so these run as part of the normal `npm test` (see
 * vite.config.ts's exclude: only `*.neon.test.ts` files are excluded from
 * the default suite, not this file).
 *
 * Covers the Windows `spawn EINVAL` bug: `spawn('npx.cmd', [...])` without
 * `shell: true` fails on Windows because a `.cmd` file is a batch script,
 * not a native executable, and Node's `child_process.spawn` calls
 * `CreateProcess` directly (no shell) by default. The fix spawns
 * `process.execPath` (the real node.exe) against vitest's own resolved
 * `.mjs` CLI entry point instead — a real script, not a platform-specific
 * wrapper, so it needs no shell on any OS.
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// vitest/Vite's module transform gives `import.meta.url` an unreliable
// value for the test file itself (as opposed to a plain imported module),
// so this resolves relative to the process's cwd instead — vitest is
// always run from the project root (via the `test`/`test:neon` npm
// scripts), matching how server/test/neon/run.mjs itself is invoked.
const require = createRequire(path.join(process.cwd(), 'package.json'))
const RUN_SCRIPT = path.join(process.cwd(), 'server', 'test', 'neon', 'run.mjs')

function runLauncher(env: Record<string, string | undefined>): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const merged: Record<string, string | undefined> = { ...process.env }
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete merged[key]
      else merged[key] = value
    }
    const child = spawn(process.execPath, [RUN_SCRIPT], {
      env: merged,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (d) => (output += d.toString()))
    child.stderr.on('data', (d) => (output += d.toString()))
    child.on('exit', (code) => resolve({ code, output }))
  })
}

describe('vitest CLI entry resolution (the actual fix)', () => {
  it('resolves to a real file on disk from the installed vitest package, not a guessed path', () => {
    const vitestPkgPath = require.resolve('vitest/package.json')
    const vitestPkg = require('vitest/package.json') as { bin?: string | Record<string, string> }
    const binRelative = typeof vitestPkg.bin === 'string' ? vitestPkg.bin : vitestPkg.bin?.vitest
    expect(binRelative).toBeTruthy()
    const entry = path.join(path.dirname(vitestPkgPath), binRelative!)
    expect(existsSync(entry)).toBe(true)
  })
})

describe('run.mjs — safety gates (no database involved)', () => {
  it('refuses to run with DATABASE_URL unset, exits non-zero, never attempts to spawn vitest', async () => {
    const { code, output } = await runLauncher({ DATABASE_URL: undefined })
    expect(code).toBe(1)
    expect(output).toMatch(/DATABASE_URL is not set/i)
    // Confirms it exited during the early guard, not mid-spawn.
    expect(output).not.toMatch(/target database/i)
  }, 15_000)

  it('rejects a malformed DATABASE_URL before attempting to connect or spawn anything', async () => {
    const { code, output } = await runLauncher({ DATABASE_URL: 'not a url' })
    expect(code).toBe(1)
    expect(output).toMatch(/not a valid connection url/i)
  }, 15_000)

  it('never prints a username or password, only host and database, for a well-formed target', async () => {
    // A syntactically valid but unreachable host — this run is killed
    // before it would ever complete a real connection attempt; the point
    // here is only to check what gets printed before that.
    const child = spawn(process.execPath, [RUN_SCRIPT], {
      env: { ...process.env, DATABASE_URL: 'postgres://secret-user:secret-password@db.example.invalid/mydb' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (d) => (output += d.toString()))
    child.stderr.on('data', (d) => (output += d.toString()))

    await new Promise((resolve) => setTimeout(resolve, 2000))
    child.kill()
    await new Promise((resolve) => child.on('exit', resolve))

    expect(output).toMatch(/host:\s+db\.example\.invalid/)
    expect(output).toMatch(/database:\s+mydb/)
    expect(output).not.toContain('secret-user')
    expect(output).not.toContain('secret-password')
    expect(output).not.toContain('postgres://secret-user:secret-password')
  }, 15_000)

  it(
    'with a well-formed DATABASE_URL, successfully spawns the vitest child process on this platform (the actual Windows EINVAL regression)',
    async () => {
      const child = spawn(process.execPath, [RUN_SCRIPT], {
        env: {
          ...process.env,
          DATABASE_URL: 'postgres://u:p@does-not-resolve.invalid.example/db',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let output = ''
      let spawnError: Error | null = null
      child.stdout.on('data', (d) => (output += d.toString()))
      child.stderr.on('data', (d) => (output += d.toString()))
      child.on('error', (err) => {
        spawnError = err
      })

      // Give it past the 3s confirmation delay so vitest has actually
      // started (or failed to start) before checking. Deliberately not
      // awaiting the child's exit afterward: run.mjs's own child (vitest)
      // goes on to retry a DNS lookup for the fake host, and killing run.mjs
      // doesn't terminate that grandchild process tree, so waiting for a
      // clean exit here is unreliable across platforms — the exit/cleanup
      // path is unrelated to what this test checks (did spawn() itself
      // succeed, not what happens after).
      await new Promise((resolve) => setTimeout(resolve, 6000))
      child.kill()

      // The old bug surfaced as `spawn EINVAL` immediately — never got this far.
      expect(spawnError).toBeNull()
      expect(output).not.toMatch(/EINVAL/)
      // Vitest itself started up (its own banner), proving the child
      // process launch succeeded end-to-end — only DNS/connection to the
      // deliberately-fake host would fail from here, which is expected and
      // not what this test is checking.
      expect(output).toMatch(/RUN|vitest/i)
    },
    15_000,
  )
})
