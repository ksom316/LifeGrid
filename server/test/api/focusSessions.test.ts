import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { __setTestPool } from '../../db.ts'
import { createMigratedTestSql } from '../testDb.ts'
import { createTestUser } from '../fixtures.ts'
import { mockReq, mockRes } from '../testHttp.ts'
import type { SqlPool } from '../../db.ts'

// api/focus-sessions/{index,[id],[id]/pause,[id]/resume,[id]/complete}.ts
// were consolidated into api/focus-sessions.ts — see vercel.json's rewrites.
import focusSessionsDispatcher from '../../../api/focus-sessions.ts'

const focusSessionsIndex = focusSessionsDispatcher
const focusSessionCrud = focusSessionsDispatcher
function withAction(req: VercelRequest, action: string): VercelRequest {
  return { ...req, query: { ...(req.query as Record<string, string>), action } } as unknown as VercelRequest
}
function pauseRoute(req: VercelRequest, res: VercelResponse) {
  return focusSessionsDispatcher(withAction(req, 'pause'), res)
}
function resumeRoute(req: VercelRequest, res: VercelResponse) {
  return focusSessionsDispatcher(withAction(req, 'resume'), res)
}
function completeRoute(req: VercelRequest, res: VercelResponse) {
  return focusSessionsDispatcher(withAction(req, 'complete'), res)
}

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

async function startSession(): Promise<string> {
  const res = mockRes()
  await focusSessionsIndex(
    mockReq({ method: 'POST', cookie: user.cookie, body: { mode: 'start', plannedDurationMinutes: 25 } }),
    res.res,
  )
  return (res.body() as { focusSession: { id: string } }).focusSession.id
}

describe('focus session state machine', () => {
  it('starts active with zero accumulated time', async () => {
    const id = await startSession()
    const res = mockRes()
    await focusSessionCrud(mockReq({ method: 'GET', cookie: user.cookie, query: { id } }), res.res)
    const session = (res.body() as { focusSession: { status: string; accumulatedMs: number } }).focusSession
    expect(session.status).toBe('active')
    expect(session.accumulatedMs).toBe(0)
  })

  it('pauses an active session, capturing accumulated time', async () => {
    const id = await startSession()
    const res = mockRes()
    await pauseRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id } }), res.res)
    const session = (res.body() as { focusSession: { status: string; resumedAt?: string } }).focusSession
    expect(session.status).toBe('paused')
    expect(session.resumedAt).toBeUndefined()
  })

  it('pausing an already-paused session is a no-op, not an error', async () => {
    const id = await startSession()
    await pauseRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id } }), mockRes().res)
    const res = mockRes()
    await pauseRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id } }), res.res)
    expect(res.statusCode()).toBe(200)
    expect((res.body() as { focusSession: { status: string } }).focusSession.status).toBe('paused')
  })

  it('resumes a paused session', async () => {
    const id = await startSession()
    await pauseRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id } }), mockRes().res)
    const res = mockRes()
    await resumeRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id } }), res.res)
    expect((res.body() as { focusSession: { status: string } }).focusSession.status).toBe('active')
  })

  it('completes an active session, setting durationMinutes and endedAt', async () => {
    const id = await startSession()
    const res = mockRes()
    await completeRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id }, body: { outcome: 'completed' } }), res.res)
    const session = (res.body() as { focusSession: { status: string; endedAt?: string } }).focusSession
    expect(session.status).toBe('completed')
    expect(session.endedAt).toBeTruthy()
  })

  it('ending early records "interrupted", not "completed"', async () => {
    const id = await startSession()
    const res = mockRes()
    await completeRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id }, body: { outcome: 'interrupted' } }), res.res)
    expect((res.body() as { focusSession: { status: string } }).focusSession.status).toBe('interrupted')
  })

  it('completing an already-completed session twice does not change its recorded duration the second time (idempotent terminal state)', async () => {
    const id = await startSession()
    const first = mockRes()
    await completeRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id }, body: {} }), first.res)
    const firstDuration = (first.body() as { focusSession: { durationMinutes: number } }).focusSession.durationMinutes

    const second = mockRes()
    await completeRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id }, body: {} }), second.res)
    const secondDuration = (second.body() as { focusSession: { durationMinutes: number } }).focusSession.durationMinutes

    expect(secondDuration).toBe(firstDuration)
    expect((second.body() as { focusSession: { status: string } }).focusSession.status).toBe('completed')
  })

  it('cannot pause a session that has already completed', async () => {
    const id = await startSession()
    await completeRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id }, body: {} }), mockRes().res)
    const res = mockRes()
    await pauseRoute(mockReq({ method: 'POST', cookie: user.cookie, query: { id } }), res.res)
    expect((res.body() as { focusSession: { status: string } }).focusSession.status).toBe('completed')
  })

  it('logs a manually-recorded ("already finished") session directly', async () => {
    const res = mockRes()
    await focusSessionsIndex(
      mockReq({ method: 'POST', cookie: user.cookie, body: { mode: 'log', durationMinutes: 40, note: 'Deep work' } }),
      res.res,
    )
    expect(res.statusCode()).toBe(201)
    const session = (res.body() as { focusSession: { status: string; durationMinutes: number } }).focusSession
    expect(session.status).toBe('completed')
    expect(session.durationMinutes).toBe(40)
  })
})
