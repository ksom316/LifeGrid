import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __setTestPool } from '../server/db.ts'
import { createMigratedTestSql } from '../server/test/testDb.ts'
import { createTestUser } from '../server/test/fixtures.ts'
import { mockReq, mockRes } from '../server/test/testHttp.ts'
import type { SqlPool } from '../server/db.ts'

import projectsIndex from './projects/index.ts'
import projectById from './projects/[id].ts'
import tasksIndex from './tasks/index.ts'
import notesIndex from './notes/index.ts'
import noteById from './notes/[id].ts'
import dailyPlanByDate from './daily-plans/[date].ts'
import weeklyReviewByWeek from './weekly-reviews/[weekStart].ts'

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

describe('project CRUD', () => {
  it('creates, reads, updates, and deletes a project', async () => {
    const createRes = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'Garden' } }), createRes.res)
    const id = (createRes.body() as { project: { id: string } }).project.id

    const patchRes = mockRes()
    await projectById(mockReq({ method: 'PATCH', cookie: user.cookie, query: { id }, body: { status: 'completed' } }), patchRes.res)
    expect((patchRes.body() as { project: { status: string; name: string } }).project.status).toBe('completed')
    expect((patchRes.body() as { project: { status: string; name: string } }).project.name).toBe('Garden') // untouched fields preserved

    await projectById(mockReq({ method: 'DELETE', cookie: user.cookie, query: { id } }), mockRes().res)
    const getRes = mockRes()
    await projectById(mockReq({ method: 'GET', cookie: user.cookie, query: { id } }), getRes.res)
    expect(getRes.statusCode()).toBe(404)
  })

  it('deleting a project detaches its tasks rather than deleting them (preserves history)', async () => {
    const projectRes = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'Kitchen' } }), projectRes.res)
    const projectId = (projectRes.body() as { project: { id: string } }).project.id

    const taskRes = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'Buy tiles', projectId } }), taskRes.res)

    await projectById(mockReq({ method: 'DELETE', cookie: user.cookie, query: { id: projectId } }), mockRes().res)

    const listRes = mockRes()
    await tasksIndex(mockReq({ method: 'GET', cookie: user.cookie }), listRes.res)
    const tasks = (listRes.body() as { tasks: { title: string; projectId?: string }[] }).tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Buy tiles')
    expect(tasks[0].projectId).toBeUndefined()
  })
})

describe('note CRUD', () => {
  it('creates, pins (via PATCH), and deletes a note', async () => {
    const createRes = mockRes()
    await notesIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'Idea', tags: ['x', 'y'] } }), createRes.res)
    const id = (createRes.body() as { note: { id: string } }).note.id

    const patchRes = mockRes()
    await noteById(mockReq({ method: 'PATCH', cookie: user.cookie, query: { id }, body: { pinned: true } }), patchRes.res)
    expect((patchRes.body() as { note: { pinned: boolean; tags: string[] } }).note.pinned).toBe(true)
    expect((patchRes.body() as { note: { pinned: boolean; tags: string[] } }).note.tags).toEqual(['x', 'y'])

    await noteById(mockReq({ method: 'DELETE', cookie: user.cookie, query: { id } }), mockRes().res)
    const getRes = mockRes()
    await noteById(mockReq({ method: 'GET', cookie: user.cookie, query: { id } }), getRes.res)
    expect(getRes.statusCode()).toBe(404)
  })
})

describe('daily plans', () => {
  it('adding the same task twice does not duplicate it in the list', async () => {
    const taskRes = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'Task' } }), taskRes.res)
    const taskId = (taskRes.body() as { task: { id: string } }).task.id

    await dailyPlanByDate(mockReq({ method: 'POST', cookie: user.cookie, query: { date: '2026-03-10' }, body: { taskId } }), mockRes().res)
    await dailyPlanByDate(mockReq({ method: 'POST', cookie: user.cookie, query: { date: '2026-03-10' }, body: { taskId } }), mockRes().res)

    const res = mockRes()
    await dailyPlanByDate(mockReq({ method: 'GET', cookie: user.cookie, query: { date: '2026-03-10' } }), res.res)
    expect((res.body() as { dailyPlan: { taskIds: string[] } }).dailyPlan.taskIds).toEqual([taskId])
  })

  it('removing a task from the plan is idempotent', async () => {
    const taskRes = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'Task' } }), taskRes.res)
    const taskId = (taskRes.body() as { task: { id: string } }).task.id
    await dailyPlanByDate(mockReq({ method: 'POST', cookie: user.cookie, query: { date: '2026-03-10' }, body: { taskId } }), mockRes().res)

    await dailyPlanByDate(mockReq({ method: 'DELETE', cookie: user.cookie, query: { date: '2026-03-10' }, body: { taskId } }), mockRes().res)
    const res = mockRes()
    await dailyPlanByDate(mockReq({ method: 'DELETE', cookie: user.cookie, query: { date: '2026-03-10' }, body: { taskId } }), res.res)
    expect((res.body() as { dailyPlan: { taskIds: string[] } }).dailyPlan.taskIds).toEqual([])
  })

  it('a date with no record yet returns an empty plan rather than 404', async () => {
    const res = mockRes()
    await dailyPlanByDate(mockReq({ method: 'GET', cookie: user.cookie, query: { date: '2099-01-01' } }), res.res)
    expect(res.statusCode()).toBe(200)
    expect((res.body() as { dailyPlan: { taskIds: string[] } }).dailyPlan.taskIds).toEqual([])
  })
})

describe('weekly reviews', () => {
  it('saving a review for a week that already has one updates it in place rather than duplicating', async () => {
    await weeklyReviewByWeek(
      mockReq({ method: 'PUT', cookie: user.cookie, query: { weekStart: '2026-03-09' }, body: { wins: 'First draft', blockers: '', lessons: '', nextSteps: '' } }),
      mockRes().res,
    )
    const res = mockRes()
    await weeklyReviewByWeek(
      mockReq({ method: 'PUT', cookie: user.cookie, query: { weekStart: '2026-03-09' }, body: { wins: 'Revised', blockers: 'None', lessons: '', nextSteps: '' } }),
      res.res,
    )
    expect((res.body() as { weeklyReview: { wins: string; blockers: string } }).weeklyReview.wins).toBe('Revised')
    expect((res.body() as { weeklyReview: { wins: string; blockers: string } }).weeklyReview.blockers).toBe('None')
  })
})
