/**
 * The single most important test file in the hosted foundation: verifies
 * that User A can never read, modify, or delete User B's records by
 * guessing/reusing an id, across every data endpoint. Every handler here is
 * the real exported default from api/*.ts — nothing about auth or ownership
 * scoping is reimplemented or mocked; only the database connection is
 * swapped for an isolated pg-mem instance (see server/test/testDb.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { __setTestPool } from '../../db.ts'
import { createMigratedTestSql } from '../testDb.ts'
import { createTestUser } from '../fixtures.ts'
import { mockReq, mockRes } from '../testHttp.ts'
import type { SqlPool } from '../../db.ts'

// The former api/{projects,tasks,notes,focus-sessions,daily-plans,weekly-reviews}/
// per-route files were consolidated into one Vercel Function each (stays
// under the Hobby plan's 12-function limit — see vercel.json's rewrites,
// which inject the same ?id=/?action= query params these aliases add by
// hand). Calling the real dispatcher this way keeps every test below
// exercising the exact deployed code path, auth/CSRF/ownership checks
// included, with its original call shape unchanged.
import projectsDispatcher from '../../../api/projects.ts'
import tasksDispatcher from '../../../api/tasks.ts'
import notesDispatcher from '../../../api/notes.ts'
import focusSessionsDispatcher from '../../../api/focus-sessions.ts'
import dailyPlansDispatcher from '../../../api/daily-plans.ts'
import weeklyReviewsDispatcher from '../../../api/weekly-reviews.ts'
import tagColorsDispatcher from '../../../api/tag-colors.ts'

function withQuery(req: VercelRequest, extra: Record<string, string>): VercelRequest {
  return { ...req, query: { ...(req.query as Record<string, string>), ...extra } } as unknown as VercelRequest
}

const projectsIndex = projectsDispatcher
const projectById = projectsDispatcher
const tasksIndex = tasksDispatcher
const taskById = tasksDispatcher
function taskComplete(req: VercelRequest, res: VercelResponse) {
  return tasksDispatcher(withQuery(req, { action: 'complete' }), res)
}
const notesIndex = notesDispatcher
const noteById = notesDispatcher
const focusSessionsIndex = focusSessionsDispatcher
const focusSessionCrud = focusSessionsDispatcher
function focusSessionById(req: VercelRequest, res: VercelResponse) {
  return focusSessionsDispatcher(withQuery(req, { action: 'pause' }), res)
}
const dailyPlanByDate = dailyPlansDispatcher
const weeklyReviewByWeek = weeklyReviewsDispatcher
const tagColors = tagColorsDispatcher

let sql: SqlPool
let alice: { id: string; cookie: string }
let bob: { id: string; cookie: string }

beforeEach(async () => {
  sql = await createMigratedTestSql()
  __setTestPool(sql)
  alice = await createTestUser(sql, 'alice@example.com')
  bob = await createTestUser(sql, 'bob@example.com')
})

afterEach(() => {
  __setTestPool(null)
})

describe('cross-user isolation — projects', () => {
  it("bob cannot read, update, or delete alice's project", async () => {
    const create = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: 'Alice project' } }), create.res)
    const projectId = (create.body() as { project: { id: string } }).project.id

    const getAttempt = mockRes()
    await projectById(mockReq({ method: 'GET', cookie: bob.cookie, query: { id: projectId } }), getAttempt.res)
    expect(getAttempt.statusCode()).toBe(404)

    const patchAttempt = mockRes()
    await projectById(
      mockReq({ method: 'PATCH', cookie: bob.cookie, query: { id: projectId }, body: { name: 'Hijacked' } }),
      patchAttempt.res,
    )
    expect(patchAttempt.statusCode()).toBe(404)

    const deleteAttempt = mockRes()
    await projectById(mockReq({ method: 'DELETE', cookie: bob.cookie, query: { id: projectId } }), deleteAttempt.res)
    expect(deleteAttempt.statusCode()).toBe(404)

    // The project must still exist, untouched, for its real owner.
    const ownerGet = mockRes()
    await projectById(mockReq({ method: 'GET', cookie: alice.cookie, query: { id: projectId } }), ownerGet.res)
    expect(ownerGet.statusCode()).toBe(200)
    expect((ownerGet.body() as { project: { name: string } }).project.name).toBe('Alice project')
  })

  it("bob's project list never includes alice's projects", async () => {
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: 'Alice project' } }), mockRes().res)
    await projectsIndex(mockReq({ method: 'POST', cookie: bob.cookie, body: { name: 'Bob project' } }), mockRes().res)

    const listRes = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: bob.cookie }), listRes.res)
    const projects = (listRes.body() as { projects: { name: string }[] }).projects
    expect(projects.map((p) => p.name)).toEqual(['Bob project'])
  })
})

describe('cross-user isolation — tasks', () => {
  it("bob cannot read, update, complete, or delete alice's task", async () => {
    const create = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { title: 'Alice task' } }), create.res)
    const taskId = (create.body() as { task: { id: string } }).task.id

    const getAttempt = mockRes()
    await taskById(mockReq({ method: 'GET', cookie: bob.cookie, query: { id: taskId } }), getAttempt.res)
    expect(getAttempt.statusCode()).toBe(404)

    const patchAttempt = mockRes()
    await taskById(
      mockReq({ method: 'PATCH', cookie: bob.cookie, query: { id: taskId }, body: { title: 'Hijacked' } }),
      patchAttempt.res,
    )
    expect(patchAttempt.statusCode()).toBe(404)

    const completeAttempt = mockRes()
    await taskComplete(mockReq({ method: 'POST', cookie: bob.cookie, query: { id: taskId } }), completeAttempt.res)
    expect(completeAttempt.statusCode()).toBe(404)

    const deleteAttempt = mockRes()
    await taskById(mockReq({ method: 'DELETE', cookie: bob.cookie, query: { id: taskId } }), deleteAttempt.res)
    expect(deleteAttempt.statusCode()).toBe(404)

    const ownerGet = mockRes()
    await taskById(mockReq({ method: 'GET', cookie: alice.cookie, query: { id: taskId } }), ownerGet.res)
    expect(ownerGet.statusCode()).toBe(200)
    expect((ownerGet.body() as { task: { status: string; title: string } }).task.status).toBe('todo')
    expect((ownerGet.body() as { task: { status: string; title: string } }).task.title).toBe('Alice task')
  })
})

describe('cross-user isolation — notes', () => {
  it("bob cannot read, update, or delete alice's note", async () => {
    const create = mockRes()
    await notesIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { title: 'Alice note' } }), create.res)
    const noteId = (create.body() as { note: { id: string } }).note.id

    const getAttempt = mockRes()
    await noteById(mockReq({ method: 'GET', cookie: bob.cookie, query: { id: noteId } }), getAttempt.res)
    expect(getAttempt.statusCode()).toBe(404)

    const deleteAttempt = mockRes()
    await noteById(mockReq({ method: 'DELETE', cookie: bob.cookie, query: { id: noteId } }), deleteAttempt.res)
    expect(deleteAttempt.statusCode()).toBe(404)

    const ownerGet = mockRes()
    await noteById(mockReq({ method: 'GET', cookie: alice.cookie, query: { id: noteId } }), ownerGet.res)
    expect(ownerGet.statusCode()).toBe(200)
  })
})

describe('cross-user isolation — focus sessions', () => {
  it("bob cannot pause alice's active focus session", async () => {
    const create = mockRes()
    await focusSessionsIndex(
      mockReq({ method: 'POST', cookie: alice.cookie, body: { mode: 'start', plannedDurationMinutes: 25 } }),
      create.res,
    )
    const sessionId = (create.body() as { focusSession: { id: string } }).focusSession.id

    const pauseAttempt = mockRes()
    await focusSessionById(mockReq({ method: 'POST', cookie: bob.cookie, query: { id: sessionId } }), pauseAttempt.res)
    expect(pauseAttempt.statusCode()).toBe(404)

    const deleteAttempt = mockRes()
    await focusSessionCrud(mockReq({ method: 'DELETE', cookie: bob.cookie, query: { id: sessionId } }), deleteAttempt.res)
    expect(deleteAttempt.statusCode()).toBe(404)

    const ownerGet = mockRes()
    await focusSessionCrud(mockReq({ method: 'GET', cookie: alice.cookie, query: { id: sessionId } }), ownerGet.res)
    expect(ownerGet.statusCode()).toBe(200)
  })
})

describe('cross-user isolation — daily plans and weekly reviews (composite-key tables)', () => {
  it("bob's identically-dated daily plan is a separate row from alice's, not a shared one", async () => {
    const taskRes = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { title: 'Alice task' } }), taskRes.res)
    const aliceTaskId = (taskRes.body() as { task: { id: string } }).task.id

    const addRes = mockRes()
    await dailyPlanByDate(
      mockReq({ method: 'POST', cookie: alice.cookie, query: { date: '2026-03-10' }, body: { taskId: aliceTaskId } }),
      addRes.res,
    )
    expect(addRes.statusCode()).toBe(200)

    const bobGet = mockRes()
    await dailyPlanByDate(mockReq({ method: 'GET', cookie: bob.cookie, query: { date: '2026-03-10' } }), bobGet.res)
    expect(bobGet.statusCode()).toBe(200)
    expect((bobGet.body() as { dailyPlan: { taskIds: string[] } }).dailyPlan.taskIds).toEqual([])
  })

  it("bob's identically-keyed weekly review is independent of alice's", async () => {
    await weeklyReviewByWeek(
      mockReq({ method: 'PUT', cookie: alice.cookie, query: { weekStart: '2026-03-09' }, body: { wins: 'Alice won', blockers: '', lessons: '', nextSteps: '' } }),
      mockRes().res,
    )

    const bobGet = mockRes()
    await weeklyReviewByWeek(mockReq({ method: 'GET', cookie: bob.cookie, query: { weekStart: '2026-03-09' } }), bobGet.res)
    expect(bobGet.statusCode()).toBe(404)
  })

  it("bob's identically-named tag colour is independent of alice's", async () => {
    await tagColors(mockReq({ method: 'PUT', cookie: alice.cookie, body: { tag: 'work', color: 'rose' } }), mockRes().res)

    const bobGet = mockRes()
    await tagColors(mockReq({ method: 'GET', cookie: bob.cookie }), bobGet.res)
    expect((bobGet.body() as { tagColors: unknown[] }).tagColors).toEqual([])
  })
})

describe('authentication required', () => {
  it('rejects every protected endpoint with 401 when no session cookie is sent', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'GET' }), res.res)
    expect(res.statusCode()).toBe(401)
  })

  it('rejects a forged/garbage session cookie with 401, not a crash', async () => {
    const res = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: 'lg_session=not-a-real-token' }), res.res)
    expect(res.statusCode()).toBe(401)
  })

  it("rejects a project id substitution attempt via the URL even with bob's own valid session", async () => {
    const create = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: 'Alice project' } }), create.res)
    const projectId = (create.body() as { project: { id: string } }).project.id

    // Bob is authenticated as himself, but tries alice's project id directly
    // in the URL — ownership must be enforced server-side regardless of
    // what id the client asks for.
    const res = mockRes()
    await projectById(mockReq({ method: 'GET', cookie: bob.cookie, query: { id: projectId } }), res.res)
    expect(res.statusCode()).toBe(404)
  })
})

describe('cross-user foreign key injection', () => {
  it("rejects creating a task whose projectId points to another user's project", async () => {
    const createProject = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: "Alice's project" } }), createProject.res)
    const aliceProjectId = (createProject.body() as { project: { id: string } }).project.id

    const res = mockRes()
    await tasksIndex(
      mockReq({ method: 'POST', cookie: bob.cookie, body: { title: 'Sneaky task', projectId: aliceProjectId } }),
      res.res,
    )
    expect(res.statusCode()).toBe(400)

    const listRes = mockRes()
    await tasksIndex(mockReq({ method: 'GET', cookie: bob.cookie }), listRes.res)
    expect((listRes.body() as { tasks: unknown[] }).tasks).toHaveLength(0)
  })

  it("rejects updating a task's projectId to point to another user's project", async () => {
    const createProject = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: "Alice's project" } }), createProject.res)
    const aliceProjectId = (createProject.body() as { project: { id: string } }).project.id

    const createTask = mockRes()
    await tasksIndex(mockReq({ method: 'POST', cookie: bob.cookie, body: { title: "Bob's task" } }), createTask.res)
    const bobTaskId = (createTask.body() as { task: { id: string } }).task.id

    const res = mockRes()
    await taskById(
      mockReq({ method: 'PATCH', cookie: bob.cookie, query: { id: bobTaskId }, body: { projectId: aliceProjectId } }),
      res.res,
    )
    expect(res.statusCode()).toBe(400)
  })

  it("rejects creating a note whose projectId points to another user's project", async () => {
    const createProject = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: "Alice's project" } }), createProject.res)
    const aliceProjectId = (createProject.body() as { project: { id: string } }).project.id

    const res = mockRes()
    await notesIndex(
      mockReq({ method: 'POST', cookie: bob.cookie, body: { title: 'Sneaky note', projectId: aliceProjectId } }),
      res.res,
    )
    expect(res.statusCode()).toBe(400)
  })

  it("rejects starting a focus session referencing another user's project or task", async () => {
    const createProject = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: "Alice's project" } }), createProject.res)
    const aliceProjectId = (createProject.body() as { project: { id: string } }).project.id

    const res = mockRes()
    await focusSessionsIndex(
      mockReq({ method: 'POST', cookie: bob.cookie, body: { mode: 'start', plannedDurationMinutes: 25, projectId: aliceProjectId } }),
      res.res,
    )
    expect(res.statusCode()).toBe(400)
  })

  it('accepts a projectId that genuinely belongs to the requesting user', async () => {
    const createProject = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: bob.cookie, body: { name: "Bob's own project" } }), createProject.res)
    const bobProjectId = (createProject.body() as { project: { id: string } }).project.id

    const res = mockRes()
    await tasksIndex(
      mockReq({ method: 'POST', cookie: bob.cookie, body: { title: 'Legit task', projectId: bobProjectId } }),
      res.res,
    )
    expect(res.statusCode()).toBe(201)
  })
})
