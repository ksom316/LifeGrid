import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __setTestPool } from '../../db.ts'
import { createMigratedTestSql } from '../testDb.ts'
import { createTestUser } from '../fixtures.ts'
import { mockReq, mockRes } from '../testHttp.ts'
import type { SqlPool } from '../../db.ts'

// Consolidated dispatchers (see api/ownership.test.ts's header comment).
import tasksIndex from '../../../api/tasks.ts'
import projectsIndex from '../../../api/projects.ts'
import notesIndex from '../../../api/notes.ts'

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

describe('task validation', () => {
  it('rejects a task with no title', async () => {
    const res = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: user.cookie, body: {} }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('rejects a task with an unrecognized status', async () => {
    const res = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'x', status: 'archived' } }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('rejects a task with an invalid due date format', async () => {
    const res = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'x', dueDate: '10/19/2026' } }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('rejects monthly recurrence missing dayOfMonth', async () => {
    const res = mockRes()
    await tasksIndex(
      mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'x', dueDate: '2026-03-10', recurrence: { frequency: 'monthly' } } }),
      res.res,
    )
    expect(res.statusCode()).toBe(400)
  })

  it('rejects recurrence with an out-of-range dayOfMonth', async () => {
    const res = mockRes()
    await tasksIndex(
      mockReq({
        method: 'POST',
        cookie: user.cookie,
        body: { title: 'x', dueDate: '2026-03-10', recurrence: { frequency: 'monthly', dayOfMonth: 40 } },
      }),
      res.res,
    )
    expect(res.statusCode()).toBe(400)
  })

  it('rejects recurrence with an out-of-range weekday', async () => {
    const res = mockRes()
    await tasksIndex(
      mockReq({
        method: 'POST',
        cookie: user.cookie,
        body: { title: 'x', dueDate: '2026-03-10', recurrence: { frequency: 'weekly', weekdays: [1, 9] } },
      }),
      res.res,
    )
    expect(res.statusCode()).toBe(400)
  })

  it('rejects a malformed projectId that is not a UUID (rather than silently failing a foreign key insert)', async () => {
    const res = mockRes()
    await tasksIndex(
      mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'x', projectId: 'not-a-uuid' } }),
      res.res,
    )
    expect(res.statusCode()).toBe(400)
  })

  it('accepts a well-formed recurring task', async () => {
    const res = mockRes()
    await tasksIndex(
      mockReq({
        method: 'POST',
        cookie: user.cookie,
        body: { title: 'Weekly sync', dueDate: '2026-03-10', recurrence: { frequency: 'weekly', weekdays: [1, 3] } },
      }),
      res.res,
    )
    expect(res.statusCode()).toBe(201)
  })
})

describe('project validation', () => {
  it('rejects a project with no name', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: user.cookie, body: {} }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('rejects an unrecognized color', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'x', color: 'chartreuse' } }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('accepts "" (automatic colour) rather than treating it as an unrecognized value', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'x', color: '' } }), res.res)
    expect(res.statusCode()).toBe(201)
  })
})

describe('note validation', () => {
  it('rejects a note with no title', async () => {
    const res = mockRes()
    await notesIndex(mockReq({ method: 'POST', cookie: user.cookie, body: {} }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('rejects tags that are not an array of strings', async () => {
    const res = mockRes()
    await notesIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'x', tags: 'not-an-array' } }), res.res)
    expect(res.statusCode()).toBe(400)
  })
})

describe('malformed request bodies', () => {
  it('rejects a non-object body (e.g. a raw JSON array or string)', async () => {
    const res = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: user.cookie, body: ['not', 'an', 'object'] }), res.res)
    expect(res.statusCode()).toBe(400)
  })
})

describe('method guards', () => {
  it('rejects an unsupported method with 405 and an Allow header', async () => {
    const res = mockRes()
    await tasksIndex(mockReq({ method: 'PUT', cookie: user.cookie }), res.res)
    expect(res.statusCode()).toBe(405)
    expect(res.headers().Allow).toContain('GET')
  })
})

describe('duplicate client-supplied id', () => {
  it('returns a clean 409, not a raw database error, when an id collides', async () => {
    const id = '12345678-1234-1234-1234-123456789abc'
    await tasksIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'First', id } }), mockRes().res)

    const res = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'Second', id } }), res.res)
    expect(res.statusCode()).toBe(409)
    const body = res.body() as { error: string }
    expect(body.error).toBe('A record with this id already exists.')
    // Never the raw driver message (would include the constraint name, SQL, etc.).
    expect(body.error).not.toMatch(/constraint|duplicate key|insert into/i)
  })
})
