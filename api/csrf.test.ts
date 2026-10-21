/**
 * CSRF defense: every state-changing request must present an Origin header
 * matching this deployment's own Host, checked in server/http.ts's
 * assertSameOrigin() before any handler logic (including auth) runs. See
 * that function's comment for why Origin-matching, not just SameSite=Lax,
 * is the chosen defense for this single-origin app.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __setTestPool } from '../server/db.ts'
import { createMigratedTestSql } from '../server/test/testDb.ts'
import { createTestUser } from '../server/test/fixtures.ts'
import { mockReq, mockRes } from '../server/test/testHttp.ts'
import type { SqlPool } from '../server/db.ts'

import projectsIndex from './projects/index.ts'
import signup from './auth/signup.ts'
import healthRoute from './health.ts'

let sql: SqlPool
let user: { id: string; cookie: string }

beforeEach(async () => {
  sql = await createMigratedTestSql()
  __setTestPool(sql)
  user = await createTestUser(sql, 'owner@example.com')
})

afterEach(() => {
  __setTestPool(null)
})

describe('assertSameOrigin — authenticated endpoints', () => {
  it('allows a same-origin POST (default test headers)', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'x' } }), res.res)
    expect(res.statusCode()).toBe(201)
  })

  it('rejects a cross-site Origin with 403, before reaching auth or the handler', async () => {
    const res = mockRes()
    await projectsIndex(
      mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'x' }, origin: 'https://evil.example' }),
      res.res,
    )
    expect(res.statusCode()).toBe(403)
  })

  it('rejects a POST with no Origin header and no Referer header at all', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'x' }, origin: null }), res.res)
    expect(res.statusCode()).toBe(403)
  })

  // A real browser's same-origin fetch() POST was observed (via Playwright,
  // against this app's own signup form) to send Referer but NOT Origin —
  // so the fallback below is not a hypothetical edge case, it's the normal
  // path for this app's own legitimate traffic.
  it('allows a same-origin POST that has Referer but no Origin header (matches real browser behavior)', async () => {
    const res = mockRes()
    await projectsIndex(
      mockReq({
        method: 'POST',
        cookie: user.cookie,
        body: { name: 'x' },
        origin: null,
        referer: 'https://life-grid.example/settings',
      }),
      res.res,
    )
    expect(res.statusCode()).toBe(201)
  })

  it('rejects a cross-site Referer when Origin is absent', async () => {
    const res = mockRes()
    await projectsIndex(
      mockReq({
        method: 'POST',
        cookie: user.cookie,
        body: { name: 'x' },
        origin: null,
        referer: 'https://evil.example/attack-page',
      }),
      res.res,
    )
    expect(res.statusCode()).toBe(403)
  })

  it('rejects a POST when the Host header is missing (fails closed rather than skipping the check)', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'x' }, host: null }), res.res)
    expect(res.statusCode()).toBe(403)
  })

  it('does not require an Origin header for safe GET requests', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: user.cookie, origin: null }), res.res)
    expect(res.statusCode()).toBe(200)
  })

  it('a malicious-origin request never reaches the database (no project is created)', async () => {
    await projectsIndex(
      mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'should never exist' }, origin: 'https://evil.example' }),
      mockRes().res,
    )
    const listRes = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: user.cookie }), listRes.res)
    expect((listRes.body() as { projects: unknown[] }).projects).toHaveLength(0)
  })
})

describe('assertJsonContentType', () => {
  it('rejects a non-JSON content type on a mutating request with 415', async () => {
    const res = mockRes()
    await projectsIndex(
      mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'x' }, contentType: 'multipart/form-data; boundary=x' }),
      res.res,
    )
    expect(res.statusCode()).toBe(415)
  })

  it('rejects text/plain (the classic CSRF-form content type)', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'x' }, contentType: 'text/plain' }), res.res)
    expect(res.statusCode()).toBe(415)
  })

  it('allows application/json with a charset suffix', async () => {
    const res = mockRes()
    await projectsIndex(
      mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'x' }, contentType: 'application/json; charset=utf-8' }),
      res.res,
    )
    expect(res.statusCode()).toBe(201)
  })
})

describe('security headers', () => {
  it('sets baseline security headers on every response, including error responses', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: 'lg_session=invalid' }), res.res)
    expect(res.statusCode()).toBe(401)
    expect(res.headers()['X-Content-Type-Options']).toBe('nosniff')
    expect(res.headers()['X-Frame-Options']).toBe('DENY')
  })
})

describe('assertSameOrigin — unauthenticated endpoints', () => {
  it('rejects a cross-site signup attempt (login-CSRF defense)', async () => {
    const res = mockRes()
    await signup(
      mockReq({ method: 'POST', body: { email: 'victim@example.com', password: 'longenoughpassword' }, origin: 'https://evil.example' }),
      res.res,
    )
    expect(res.statusCode()).toBe(403)
  })

  it('health check (GET) needs no Origin header', async () => {
    const res = mockRes()
    await healthRoute(mockReq({ method: 'GET', origin: null }), res.res)
    expect(res.statusCode()).toBe(200)
  })
})
