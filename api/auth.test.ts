import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __setTestPool } from '../server/db.ts'
import { createMigratedTestSql } from '../server/test/testDb.ts'
import { mockReq, mockRes } from '../server/test/testHttp.ts'
import type { SqlPool } from '../server/db.ts'

import signup from './auth/signup.ts'
import login from './auth/login.ts'
import logout from './auth/logout.ts'
import session from './auth/session.ts'

let sql: SqlPool

beforeEach(async () => {
  sql = await createMigratedTestSql()
  __setTestPool(sql)
})

afterEach(() => {
  __setTestPool(null)
})

function cookieFrom(res: ReturnType<typeof mockRes>): string {
  const header = res.headers()['Set-Cookie']
  return header.split(';')[0]
}

describe('signup', () => {
  it('creates an account and sets a session cookie', async () => {
    const res = mockRes()
    await signup(mockReq({ method: 'POST', body: { email: 'new@example.com', password: 'longenoughpassword' } }), res.res)
    expect(res.statusCode()).toBe(201)
    expect((res.body() as { user: { email: string } }).user.email).toBe('new@example.com')
    expect(res.headers()['Set-Cookie']).toMatch(/^lg_session=/)
  })

  it('rejects a duplicate email', async () => {
    await signup(mockReq({ method: 'POST', body: { email: 'dup@example.com', password: 'longenoughpassword' } }), mockRes().res)
    const res = mockRes()
    await signup(mockReq({ method: 'POST', body: { email: 'dup@example.com', password: 'anotherpassword' } }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('treats email case-insensitively for duplicate detection', async () => {
    await signup(mockReq({ method: 'POST', body: { email: 'Case@Example.com', password: 'longenoughpassword' } }), mockRes().res)
    const res = mockRes()
    await signup(mockReq({ method: 'POST', body: { email: 'case@example.com', password: 'anotherpassword' } }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('rejects a malformed email', async () => {
    const res = mockRes()
    await signup(mockReq({ method: 'POST', body: { email: 'not-an-email', password: 'longenoughpassword' } }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('rejects a short password', async () => {
    const res = mockRes()
    await signup(mockReq({ method: 'POST', body: { email: 'short@example.com', password: 'short' } }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('rejects a missing email or password', async () => {
    const res = mockRes()
    await signup(mockReq({ method: 'POST', body: {} }), res.res)
    expect(res.statusCode()).toBe(400)
  })
})

describe('login', () => {
  beforeEach(async () => {
    await signup(mockReq({ method: 'POST', body: { email: 'owner@example.com', password: 'correcthorsebattery' } }), mockRes().res)
  })

  it('logs in with correct credentials and sets a fresh session cookie', async () => {
    const res = mockRes()
    await login(mockReq({ method: 'POST', body: { email: 'owner@example.com', password: 'correcthorsebattery' } }), res.res)
    expect(res.statusCode()).toBe(200)
    expect(res.headers()['Set-Cookie']).toMatch(/^lg_session=/)
  })

  it('rejects the wrong password without revealing whether the email exists', async () => {
    const wrongPassword = mockRes()
    await login(mockReq({ method: 'POST', body: { email: 'owner@example.com', password: 'wrongpassword' } }), wrongPassword.res)
    const noSuchUser = mockRes()
    await login(mockReq({ method: 'POST', body: { email: 'nobody@example.com', password: 'whatever123' } }), noSuchUser.res)

    expect(wrongPassword.statusCode()).toBe(401)
    expect(noSuchUser.statusCode()).toBe(401)
    expect((wrongPassword.body() as { error: string }).error).toBe((noSuchUser.body() as { error: string }).error)
  })
})

describe('session', () => {
  it('returns the authenticated user for a valid session cookie', async () => {
    const signupRes = mockRes()
    await signup(mockReq({ method: 'POST', body: { email: 'me@example.com', password: 'correcthorsebattery' } }), signupRes.res)
    const cookie = cookieFrom(signupRes)

    const res = mockRes()
    await session(mockReq({ method: 'GET', cookie }), res.res)
    expect(res.statusCode()).toBe(200)
    expect((res.body() as { user: { email: string } }).user.email).toBe('me@example.com')
  })

  it('returns 401 with no cookie', async () => {
    const res = mockRes()
    await session(mockReq({ method: 'GET' }), res.res)
    expect(res.statusCode()).toBe(401)
  })

  it('returns 401 after logout — the session is actually invalidated server-side, not just the cookie cleared client-side', async () => {
    const signupRes = mockRes()
    await signup(mockReq({ method: 'POST', body: { email: 'me2@example.com', password: 'correcthorsebattery' } }), signupRes.res)
    const cookie = cookieFrom(signupRes)

    await logout(mockReq({ method: 'POST', cookie }), mockRes().res)

    const res = mockRes()
    await session(mockReq({ method: 'GET', cookie }), res.res)
    expect(res.statusCode()).toBe(401)
  })
})

describe('brute-force rate limiting', () => {
  // These loop through several real login/signup attempts, and both
  // scrypt password hashing and verification are deliberately CPU-expensive
  // (that's the whole point of using scrypt) — ~10 attempts can legitimately
  // take longer than vitest's default 5s test timeout under load, so these
  // get a longer explicit one rather than a flaky default.
  it('blocks login after repeated failed attempts against the same email, with 429', async () => {
    await signup(mockReq({ method: 'POST', body: { email: 'target@example.com', password: 'correcthorsebattery' } }), mockRes().res)

    let lastStatus = 0
    for (let i = 0; i < 11; i++) {
      const res = mockRes()
      await login(mockReq({ method: 'POST', body: { email: 'target@example.com', password: 'wrong-guess' } }), res.res)
      lastStatus = res.statusCode()
    }
    // The 10th attempt is allowed through (and fails on bad credentials,
    // 401); the 11th is rate-limited before credentials are even checked.
    expect(lastStatus).toBe(429)
  }, 20_000)

  it('a rate-limited login never succeeds even with the correct password', async () => {
    await signup(mockReq({ method: 'POST', body: { email: 'target2@example.com', password: 'correcthorsebattery' } }), mockRes().res)
    for (let i = 0; i < 10; i++) {
      await login(mockReq({ method: 'POST', body: { email: 'target2@example.com', password: 'wrong-guess' } }), mockRes().res)
    }
    const res = mockRes()
    await login(mockReq({ method: 'POST', body: { email: 'target2@example.com', password: 'correcthorsebattery' } }), res.res)
    expect(res.statusCode()).toBe(429)
  }, 20_000)

  it('rate limiting on one email does not block login attempts for a different email', async () => {
    await signup(mockReq({ method: 'POST', body: { email: 'victim-a@example.com', password: 'correcthorsebattery' } }), mockRes().res)
    await signup(mockReq({ method: 'POST', body: { email: 'victim-b@example.com', password: 'correcthorsebattery' } }), mockRes().res)
    for (let i = 0; i < 10; i++) {
      await login(mockReq({ method: 'POST', body: { email: 'victim-a@example.com', password: 'wrong' } }), mockRes().res)
    }
    const res = mockRes()
    await login(mockReq({ method: 'POST', body: { email: 'victim-b@example.com', password: 'correcthorsebattery' } }), res.res)
    expect(res.statusCode()).toBe(200)
  }, 20_000)

  it('blocks repeated signup attempts against the same email', async () => {
    let lastStatus = 0
    for (let i = 0; i < 6; i++) {
      const res = mockRes()
      await signup(mockReq({ method: 'POST', body: { email: 'spam-target@example.com', password: 'longenoughpassword' } }), res.res)
      lastStatus = res.statusCode()
    }
    expect(lastStatus).toBe(429)
  }, 20_000)
})
