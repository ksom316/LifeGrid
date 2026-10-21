import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Real-PostgreSQL integration tests (server/test/neon/**/*.neon.test.ts)
    // are reachable only through `npm run test:neon` (vitest.neon.config.ts)
    // — excluded here so an ordinary `npm test` can never accidentally
    // connect to a real database just because DATABASE_URL happens to be
    // set in the shell it runs in. Only the `.neon.test.ts` files are
    // excluded, not the whole directory — a sibling file like
    // server/test/neon/run.test.ts (regression tests for the launcher
    // script's own mechanics, no database involved) is still picked up here.
    exclude: [...configDefaults.exclude, 'server/test/neon/**/*.neon.test.ts'],
    // The suite grew substantially heavier with the hosted-foundation
    // milestone (many files now spin up a pg-mem Postgres instance and
    // apply real migration SQL per test). Running all files in parallel
    // under CPU contention occasionally pushed RTL's default 5s
    // findBy/waitFor timeout past its limit on otherwise-fast UI tests —
    // not a hang, just scheduling pressure — so the default is raised
    // rather than leaving the suite intermittently flaky.
    testTimeout: 15000,
  },
})
