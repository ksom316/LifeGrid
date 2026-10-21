import { defineConfig } from 'vitest/config'

/**
 * A completely separate Vitest entry point for real-PostgreSQL integration
 * tests (server/test/neon/**), deliberately NOT reachable through the
 * default `vitest run` / `npm test` — those only discover files matching
 * the default config in vite.config.ts, which this file's `include` has no
 * relationship to. Running these tests always requires explicitly pointing
 * at this config (`npm run test:neon`, which also gates on DATABASE_URL
 * and prints the target host/database before any write — see
 * server/test/neon/run.mjs), so a real database is never touched by an
 * ordinary test run.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['server/test/neon/**/*.neon.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Real network calls to one shared database — running test files in
    // parallel would make concurrent-completion tests harder to reason
    // about (their own deliberate concurrency would compound with
    // vitest's), so files run one at a time.
    fileParallelism: false,
  },
})
