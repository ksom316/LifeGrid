import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// RTL's findBy*/waitFor default to a 1s budget, which the IndexedDB/pg-mem-backed
// renders here exceed under CPU contention (verified on the pre-redesign baseline
// too); a roomier budget only delays failure, it never slows a passing test.
configure({ asyncUtilTimeout: 5000 })

// jsdom doesn't implement scrollIntoView; components that call it (e.g. to
// reveal a highlighted search result) would otherwise throw in tests.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

/**
 * There is no real hosted API running in the test environment, and Node's
 * native fetch does not fail a relative URL request immediately/
 * synchronously the way this suite needs (it was observed to hang toward
 * its default timeout instead) — so every test gets a stubbed `fetch` that
 * answers any /api/* request with 401 by default, matching "no one is
 * signed in," which is how every existing (pre-hosted-foundation) test
 * expects the app to behave. A test that specifically exercises signed-in
 * behavior overrides this stub itself (see src/state/AuthContext.test.tsx).
 */
const originalFetch = globalThis.fetch
beforeEach(() => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 })) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
})
