import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __setTestPool } from '../../db.ts'
import { createMigratedTestSql } from '../testDb.ts'
import { createTestUser } from '../fixtures.ts'
import { mockReq, mockRes } from '../testHttp.ts'
import type { SqlPool } from '../../db.ts'

// Consolidated dispatchers (see api/ownership.test.ts's header comment for
// the full explanation — same pattern here).
import projectsDispatcher from '../../../api/projects.ts'
import tasksDispatcher from '../../../api/tasks.ts'
import notesDispatcher from '../../../api/notes.ts'
import dailyPlansDispatcher from '../../../api/daily-plans.ts'
import weeklyReviewsDispatcher from '../../../api/weekly-reviews.ts'
import tagColorsDispatcher from '../../../api/tag-colors.ts'

const projectsIndex = projectsDispatcher
const projectById = projectsDispatcher
const tasksIndex = tasksDispatcher
const notesIndex = notesDispatcher
const noteById = notesDispatcher
const dailyPlanByDate = dailyPlansDispatcher
const weeklyReviewByWeek = weeklyReviewsDispatcher
const tagColors = tagColorsDispatcher

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

  it('leaves colour unset (automatic) when none is given at creation', async () => {
    const createRes = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'No colour yet' } }), createRes.res)
    expect((createRes.body() as { project: { color: string } }).project.color).toBe('')
  })

  it('accepts an explicit "" on creation (not just an omitted field) as a request for automatic colour', async () => {
    const createRes = mockRes()
    await projectsIndex(
      mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'Explicit empty', color: '' } }),
      createRes.res,
    )
    expect(createRes.statusCode()).toBe(201)
    expect((createRes.body() as { project: { color: string } }).project.color).toBe('')
  })

  it('persists an explicit colour and lets it be reset back to automatic', async () => {
    const createRes = mockRes()
    await projectsIndex(
      mockReq({ method: 'POST', cookie: user.cookie, body: { name: 'Coloured', color: 'teal' } }),
      createRes.res,
    )
    const id = (createRes.body() as { project: { id: string; color: string } }).project.id
    expect((createRes.body() as { project: { color: string } }).project.color).toBe('teal')

    const resetRes = mockRes()
    await projectById(mockReq({ method: 'PATCH', cookie: user.cookie, query: { id }, body: { color: '' } }), resetRes.res)
    expect((resetRes.body() as { project: { color: string } }).project.color).toBe('')
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

  it('defaults a new note to autocorrect enabled, and persists turning it off', async () => {
    const createRes = mockRes()
    await notesIndex(mockReq({ method: 'POST', cookie: user.cookie, body: { title: 'Snippet' } }), createRes.res)
    const note = (createRes.body() as { note: { id: string; autocorrect?: boolean } }).note
    // Undefined (not explicitly false) still means "enabled" — see
    // noteAutocorrectEnabled in src/data/notes.ts.
    expect(note.autocorrect).not.toBe(false)

    const patchRes = mockRes()
    await noteById(
      mockReq({ method: 'PATCH', cookie: user.cookie, query: { id: note.id }, body: { autocorrect: false } }),
      patchRes.res,
    )
    expect((patchRes.body() as { note: { autocorrect: boolean } }).note.autocorrect).toBe(false)

    const getRes = mockRes()
    await noteById(mockReq({ method: 'GET', cookie: user.cookie, query: { id: note.id } }), getRes.res)
    expect((getRes.body() as { note: { autocorrect: boolean } }).note.autocorrect).toBe(false)
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

describe('tag colours', () => {
  it('sets and lists a tag colour override', async () => {
    await tagColors(mockReq({ method: 'PUT', cookie: user.cookie, body: { tag: 'work', color: 'rose' } }), mockRes().res)

    const res = mockRes()
    await tagColors(mockReq({ method: 'GET', cookie: user.cookie }), res.res)
    const list = (res.body() as { tagColors: { id: string; color: string }[] }).tagColors
    expect(list).toEqual([expect.objectContaining({ id: 'work', color: 'rose' })])
  })

  it('setting a colour for the same tag twice updates it in place rather than duplicating', async () => {
    await tagColors(mockReq({ method: 'PUT', cookie: user.cookie, body: { tag: 'work', color: 'rose' } }), mockRes().res)
    await tagColors(mockReq({ method: 'PUT', cookie: user.cookie, body: { tag: 'work', color: 'teal' } }), mockRes().res)

    const res = mockRes()
    await tagColors(mockReq({ method: 'GET', cookie: user.cookie }), res.res)
    const list = (res.body() as { tagColors: { id: string; color: string }[] }).tagColors
    expect(list).toHaveLength(1)
    expect(list[0].color).toBe('teal')
  })

  it('normalizes tag text (trim/lowercase) so the same tag is addressed consistently', async () => {
    await tagColors(mockReq({ method: 'PUT', cookie: user.cookie, body: { tag: '  Work  ', color: 'rose' } }), mockRes().res)

    const res = mockRes()
    await tagColors(mockReq({ method: 'GET', cookie: user.cookie }), res.res)
    const list = (res.body() as { tagColors: { id: string; color: string }[] }).tagColors
    expect(list).toEqual([expect.objectContaining({ id: 'work', color: 'rose' })])
  })

  it('rejects an invalid colour value', async () => {
    const res = mockRes()
    await tagColors(mockReq({ method: 'PUT', cookie: user.cookie, body: { tag: 'work', color: 'not-a-colour' } }), res.res)
    expect(res.statusCode()).toBe(400)
  })

  it('removes a tag colour override', async () => {
    await tagColors(mockReq({ method: 'PUT', cookie: user.cookie, body: { tag: 'work', color: 'rose' } }), mockRes().res)
    await tagColors(mockReq({ method: 'DELETE', cookie: user.cookie, body: { tag: 'work' } }), mockRes().res)

    const res = mockRes()
    await tagColors(mockReq({ method: 'GET', cookie: user.cookie }), res.res)
    expect((res.body() as { tagColors: unknown[] }).tagColors).toEqual([])
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
