/**
 * Dedicated tests for the consolidated dispatcher files themselves (the
 * routing logic added when api/*.ts route files were merged down to stay
 * under Vercel Hobby's 12-function limit — see vercel.json's rewrites).
 * Every other api/*.test.ts file already exercises these dispatchers
 * through their real business logic; this file specifically targets the
 * dispatch/routing behavior in isolation: unknown actions, malformed or
 * unexpected query shapes, and confirming a request never silently falls
 * through to the wrong handler.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __setTestPool } from '../../db.ts'
import { createMigratedTestSql } from '../testDb.ts'
import { createTestUser } from '../fixtures.ts'
import { mockReq, mockRes } from '../testHttp.ts'
import type { SqlPool } from '../../db.ts'

import authDispatcher from '../../../api/auth.ts'
import backupDispatcher from '../../../api/backup.ts'
import dailyPlansDispatcher from '../../../api/daily-plans.ts'
import focusSessionsDispatcher from '../../../api/focus-sessions.ts'
import notesDispatcher from '../../../api/notes.ts'
import projectsDispatcher from '../../../api/projects.ts'
import tasksDispatcher from '../../../api/tasks.ts'
import weeklyReviewsDispatcher from '../../../api/weekly-reviews.ts'

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

describe('api/auth.ts — unauthenticated dispatcher', () => {
  it('404s on an unrecognized action', async () => {
    const res = mockRes()
    await authDispatcher(mockReq({ method: 'POST', query: { action: 'not-a-real-action' } }), res.res)
    expect(res.statusCode()).toBe(404)
  })

  it('404s when no action is present at all (hitting /api/auth directly)', async () => {
    const res = mockRes()
    await authDispatcher(mockReq({ method: 'GET' }), res.res)
    expect(res.statusCode()).toBe(404)
  })

  it('still enforces CSRF/content-type checks before routing to an action', async () => {
    const res = mockRes()
    await authDispatcher(
      mockReq({ method: 'POST', query: { action: 'login' }, origin: 'https://evil.example', body: { email: 'a@b.com', password: 'whatever1' } }),
      res.res,
    )
    expect(res.statusCode()).toBe(403)
  })
})

describe('api/backup.ts — authenticated dispatcher', () => {
  it('404s on an unrecognized action for an authenticated user', async () => {
    const res = mockRes()
    await backupDispatcher(mockReq({ method: 'POST', cookie: user.cookie, query: { action: 'delete-everything' } }), res.res)
    expect(res.statusCode()).toBe(404)
  })

  it('requires authentication before routing — 401, not 404, with no session', async () => {
    const res = mockRes()
    await backupDispatcher(mockReq({ method: 'GET', query: { action: 'export' } }), res.res)
    expect(res.statusCode()).toBe(401)
  })
})

describe('api/tasks.ts — id/action routing', () => {
  it('routes the bare collection path (no id) to the index handler', async () => {
    const res = mockRes()
    await tasksDispatcher(mockReq({ method: 'GET', cookie: user.cookie }), res.res)
    expect(res.statusCode()).toBe(200)
    expect((res.body() as { tasks: unknown[] }).tasks).toEqual([])
  })

  it('404s for an id with an unrecognized action, rather than falling through to the plain by-id handler', async () => {
    const create = mockRes()
    await tasksDispatcher(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'x' } }), create.res)
    const id = (create.body() as { task: { id: string } }).task.id

    const res = mockRes()
    await tasksDispatcher(mockReq({ method: 'GET', cookie: user.cookie, query: { id, action: 'delete-forever' } }), res.res)
    expect(res.statusCode()).toBe(404)
  })

  it('treats an id given as an array (malformed query) as not-found rather than crashing', async () => {
    const res = mockRes()
    await tasksDispatcher(
      mockReq({ method: 'GET', cookie: user.cookie, query: { id: ['a', 'b'] as unknown as string } }),
      res.res,
    )
    expect(res.statusCode()).toBe(404)
  })

  it('an empty-string id is routed to the by-id handler, not silently treated as the collection route', async () => {
    const res = mockRes()
    await tasksDispatcher(mockReq({ method: 'GET', cookie: user.cookie, query: { id: '' } }), res.res)
    // Empty string is a defined value (`id === undefined` is what selects
    // the collection route), so dispatch correctly reaches the by-id
    // handler. That handler then fails to cast '' to the `id` column's
    // uuid type and 500s — unchanged, pre-existing behavior from before
    // this consolidation (the original [id].ts only ever checked
    // `typeof id !== 'string'`, never UUID format, so it had the exact
    // same gap). Fixing that gap is out of scope for this routing change;
    // this assertion exists only to prove dispatch itself routed correctly
    // — to *a* handler, and the correct one, not a 200 from the index route.
    expect(res.statusCode()).toBe(500)
  })
})

describe('api/focus-sessions.ts — id/action routing', () => {
  it('404s for an id with an unrecognized action', async () => {
    const create = mockRes()
    await focusSessionsDispatcher(
      mockReq({ method: 'POST', cookie: user.cookie, body: { mode: 'start', plannedDurationMinutes: 25 } }),
      create.res,
    )
    const id = (create.body() as { focusSession: { id: string } }).focusSession.id

    const res = mockRes()
    await focusSessionsDispatcher(mockReq({ method: 'POST', cookie: user.cookie, query: { id, action: 'cancel' } }), res.res)
    expect(res.statusCode()).toBe(404)
  })
})

describe('api/daily-plans.ts, api/notes.ts, api/projects.ts, api/weekly-reviews.ts — bare collection routes', () => {
  it('daily-plans: no date query routes to the index/list handler', async () => {
    const res = mockRes()
    await dailyPlansDispatcher(mockReq({ method: 'GET', cookie: user.cookie }), res.res)
    expect(res.statusCode()).toBe(200)
    expect((res.body() as { dailyPlans: unknown[] }).dailyPlans).toEqual([])
  })

  it('notes: no id query routes to the index/list handler', async () => {
    const res = mockRes()
    await notesDispatcher(mockReq({ method: 'GET', cookie: user.cookie }), res.res)
    expect(res.statusCode()).toBe(200)
    expect((res.body() as { notes: unknown[] }).notes).toEqual([])
  })

  it('projects: no id query routes to the index/list handler', async () => {
    const res = mockRes()
    await projectsDispatcher(mockReq({ method: 'GET', cookie: user.cookie }), res.res)
    expect(res.statusCode()).toBe(200)
    expect((res.body() as { projects: unknown[] }).projects).toEqual([])
  })

  it('weekly-reviews: no weekStart query routes to the index/list handler', async () => {
    const res = mockRes()
    await weeklyReviewsDispatcher(mockReq({ method: 'GET', cookie: user.cookie }), res.res)
    expect(res.statusCode()).toBe(200)
    expect((res.body() as { weeklyReviews: unknown[] }).weeklyReviews).toEqual([])
  })
})
