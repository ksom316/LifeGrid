import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { __setTestPool } from '../../db.ts'
import { createMigratedTestSql } from '../testDb.ts'
import { createTestUser } from '../fixtures.ts'
import { mockReq, mockRes } from '../testHttp.ts'
import type { SqlPool } from '../../db.ts'
import type { LifeGridBackup } from '../../../src/types/backup.ts'

// api/backup/{export,local-import,preview,restore}.ts were consolidated
// into api/backup.ts (dispatching on ?action=) — see vercel.json's rewrites.
import tasksIndex from '../../../api/tasks.ts'
import projectsIndex from '../../../api/projects.ts'
import backupDispatcher from '../../../api/backup.ts'
import clearRoute from '../../../api/data/clear.ts'

function withAction(req: VercelRequest, action: string): VercelRequest {
  return { ...req, query: { ...(req.query as Record<string, string>), action } } as unknown as VercelRequest
}
function exportBackupRoute(req: VercelRequest, res: VercelResponse) {
  return backupDispatcher(withAction(req, 'export'), res)
}
function previewRoute(req: VercelRequest, res: VercelResponse) {
  return backupDispatcher(withAction(req, 'preview'), res)
}
function restoreRoute(req: VercelRequest, res: VercelResponse) {
  return backupDispatcher(withAction(req, 'restore'), res)
}
function localImportRoute(req: VercelRequest, res: VercelResponse) {
  return backupDispatcher(withAction(req, 'local-import'), res)
}

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

describe('backup export', () => {
  it("exports only the authenticated user's data, in the standard LifeGridBackup envelope", async () => {
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: 'Alice project' } }), mockRes().res)
    await projectsIndex(mockReq({ method: 'POST', cookie: bob.cookie, body: { name: 'Bob project' } }), mockRes().res)

    const res = mockRes()
    await exportBackupRoute(mockReq({ method: 'GET', cookie: alice.cookie }), res.res)
    expect(res.statusCode()).toBe(200)
    const backup = res.body() as LifeGridBackup
    expect(backup.format).toBe('life-grid-backup')
    expect(backup.data.projects).toHaveLength(1)
    expect(backup.data.projects[0].name).toBe('Alice project')
  })
})

describe('backup preview and restore', () => {
  function validBackup(overrides: Partial<LifeGridBackup['data']> = {}): LifeGridBackup {
    const now = new Date().toISOString()
    return {
      format: 'life-grid-backup',
      version: 1,
      exportedAt: now,
      dbVersion: 2,
      includesDemoData: false,
      counts: { projects: 0, tasks: 0, notes: 0, focusSessions: 0, dailyPlans: 0, weeklyReviews: 0 },
      data: { projects: [], tasks: [], notes: [], focusSessions: [], dailyPlans: [], weeklyReviews: [], ...overrides },
    }
  }

  it('rejects an invalid backup payload with a clear error', async () => {
    const res = mockRes()
    await restoreRoute(
      mockReq({ method: 'POST', cookie: alice.cookie, body: { strategy: 'merge', backup: { not: 'a backup' } } }),
      res.res,
    )
    expect(res.statusCode()).toBe(400)
  })

  it('previews a merge without writing anything', async () => {
    const backup = validBackup({
      projects: [
        { id: '11111111-1111-1111-1111-111111111111', name: 'Imported', description: '', status: 'active', color: 'violet', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
    })
    const res = mockRes()
    await previewRoute(mockReq({ method: 'POST', cookie: alice.cookie, body: { strategy: 'merge', backup } }), res.res)
    expect(res.statusCode()).toBe(200)
    expect((res.body() as { counts: { projects: { added: number } } }).counts.projects.added).toBe(1)

    const listRes = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: alice.cookie }), listRes.res)
    expect((listRes.body() as { projects: unknown[] }).projects).toHaveLength(0)
  })

  it('restores (merge) and preserves record ids from the backup', async () => {
    const projectId = '22222222-2222-2222-2222-222222222222'
    const backup = validBackup({
      projects: [
        { id: projectId, name: 'Restored project', description: '', status: 'active', color: 'teal', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
    })
    const res = mockRes()
    await restoreRoute(mockReq({ method: 'POST', cookie: alice.cookie, body: { strategy: 'merge', backup } }), res.res)
    expect(res.statusCode()).toBe(200)

    const listRes = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: alice.cookie }), listRes.res)
    const projects = (listRes.body() as { projects: { id: string }[] }).projects
    expect(projects.map((p) => p.id)).toContain(projectId)
  })

  it("replace strategy clears only the importing user's existing data, never another user's", async () => {
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: 'Alice pre-existing' } }), mockRes().res)
    await projectsIndex(mockReq({ method: 'POST', cookie: bob.cookie, body: { name: 'Bob untouched' } }), mockRes().res)

    const backup = validBackup({
      projects: [
        { id: '33333333-3333-3333-3333-333333333333', name: 'Replacement', description: '', status: 'active', color: 'amber', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
    })
    await restoreRoute(mockReq({ method: 'POST', cookie: alice.cookie, body: { strategy: 'replace', backup } }), mockRes().res)

    const aliceList = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: alice.cookie }), aliceList.res)
    expect((aliceList.body() as { projects: { name: string }[] }).projects.map((p) => p.name)).toEqual(['Replacement'])

    const bobList = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: bob.cookie }), bobList.res)
    expect((bobList.body() as { projects: { name: string }[] }).projects.map((p) => p.name)).toEqual(['Bob untouched'])
  })

  it('merge never lets an incoming demo record overwrite a real one', async () => {
    const createRes = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: 'Real project' } }), createRes.res)
    const projectId = (createRes.body() as { project: { id: string; updatedAt: string } }).project.id

    const backup = validBackup({
      projects: [
        { id: projectId, name: 'Demo clobber attempt', description: '', status: 'active', color: 'rose', isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date(Date.now() + 1000 * 60).toISOString() },
      ],
    })
    await restoreRoute(mockReq({ method: 'POST', cookie: alice.cookie, body: { strategy: 'merge', backup } }), mockRes().res)

    const listRes = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: alice.cookie }), listRes.res)
    expect((listRes.body() as { projects: { name: string }[] }).projects[0].name).toBe('Real project')
  })

  // V1.1 security audit: restoreBackupForUser's upsert used a plain
  // `ON CONFLICT (id) DO UPDATE`, scoped by nothing but the global primary
  // key. If an incoming record's id happened to match another user's
  // existing row, the "merge"/"replace" restore would silently overwrite
  // that other user's data — fixed with both a SQL-level WHERE guard and
  // an application-level pre-check (server/repositories/backup.ts).
  it("merge restore never overwrites another user's record even if an incoming id collides with it", async () => {
    const createRes = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: "Alice's real project" } }), createRes.res)
    const aliceProjectId = (createRes.body() as { project: { id: string } }).project.id

    // Bob's "local backup" happens to contain a record with Alice's exact
    // project id (e.g. a guessed/leaked UUID, or two accounts that each
    // separately imported the same pre-migration local id) and a newer
    // updatedAt, which would win a legitimate same-owner merge.
    const backup = validBackup({
      projects: [
        {
          id: aliceProjectId,
          name: 'Overwritten by Bob',
          description: 'hacked',
          status: 'active',
          color: 'rose',
          createdAt: new Date().toISOString(),
          updatedAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        },
      ],
    })

    const restoreRes = mockRes()
    await restoreRoute(mockReq({ method: 'POST', cookie: bob.cookie, body: { strategy: 'merge', backup } }), restoreRes.res)
    expect(restoreRes.statusCode()).toBe(200)
    // Reported honestly as skipped, not silently "added".
    expect((restoreRes.body() as { counts: { projects: { added: number; skipped: number } } }).counts.projects).toEqual({
      added: 0,
      updated: 0,
      skipped: 1,
    })

    // Alice's project is completely untouched.
    const aliceGet = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: alice.cookie }), aliceGet.res)
    const aliceProjects = (aliceGet.body() as { projects: { id: string; name: string; description: string }[] }).projects
    expect(aliceProjects).toHaveLength(1)
    expect(aliceProjects[0].id).toBe(aliceProjectId)
    expect(aliceProjects[0].name).toBe("Alice's real project")
    expect(aliceProjects[0].description).not.toBe('hacked')

    // Bob's own project list does not gain a phantom record either —
    // the conflicting id was dropped, not silently reassigned to him.
    const bobGet = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: bob.cookie }), bobGet.res)
    expect((bobGet.body() as { projects: unknown[] }).projects).toHaveLength(0)
  })

  it("replace strategy also never overwrites another user's record on an id collision", async () => {
    const createRes = mockRes()
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: "Alice's real project" } }), createRes.res)
    const aliceProjectId = (createRes.body() as { project: { id: string } }).project.id

    const backup = validBackup({
      projects: [
        { id: aliceProjectId, name: 'Replaced by Bob', description: 'hacked', status: 'active', color: 'rose', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
    })

    await restoreRoute(mockReq({ method: 'POST', cookie: bob.cookie, body: { strategy: 'replace', backup } }), mockRes().res)

    const aliceGet = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: alice.cookie }), aliceGet.res)
    const aliceProjects = (aliceGet.body() as { projects: { name: string }[] }).projects
    expect(aliceProjects).toHaveLength(1)
    expect(aliceProjects[0].name).toBe("Alice's real project")
  })
})

describe('local data migration (duplicate-import prevention)', () => {
  it('importing the exact same local snapshot twice is a safe no-op the second time', async () => {
    const taskId = '44444444-4444-4444-4444-444444444444'
    const now = new Date().toISOString()
    const backup: LifeGridBackup = {
      format: 'life-grid-backup',
      version: 1,
      exportedAt: now,
      dbVersion: 2,
      includesDemoData: false,
      counts: { projects: 0, tasks: 1, notes: 0, focusSessions: 0, dailyPlans: 0, weeklyReviews: 0 },
      data: {
        projects: [],
        tasks: [{ id: taskId, title: 'Local task', notes: '', status: 'todo', priority: 'medium', createdAt: now, updatedAt: now }],
        notes: [],
        focusSessions: [],
        dailyPlans: [],
        weeklyReviews: [],
      },
    }

    const first = mockRes()
    await localImportRoute(mockReq({ method: 'POST', cookie: alice.cookie, body: { strategy: 'merge', backup } }), first.res)
    expect(first.statusCode()).toBe(200)
    expect((first.body() as { alreadyImported: boolean }).alreadyImported).toBe(false)

    const second = mockRes()
    await localImportRoute(mockReq({ method: 'POST', cookie: alice.cookie, body: { strategy: 'merge', backup } }), second.res)
    expect((second.body() as { alreadyImported: boolean }).alreadyImported).toBe(true)

    const listRes = mockRes()
    await tasksIndex(mockReq({ method: 'GET', cookie: alice.cookie }), listRes.res)
    expect((listRes.body() as { tasks: unknown[] }).tasks).toHaveLength(1) // not duplicated
  })
})

describe('clear real data', () => {
  it("clears only the authenticated user's data, never another user's", async () => {
    await projectsIndex(mockReq({ method: 'POST', cookie: alice.cookie, body: { name: 'Alice project' } }), mockRes().res)
    await projectsIndex(mockReq({ method: 'POST', cookie: bob.cookie, body: { name: 'Bob project' } }), mockRes().res)

    await clearRoute(mockReq({ method: 'POST', cookie: alice.cookie }), mockRes().res)

    const aliceList = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: alice.cookie }), aliceList.res)
    expect((aliceList.body() as { projects: unknown[] }).projects).toHaveLength(0)

    const bobList = mockRes()
    await projectsIndex(mockReq({ method: 'GET', cookie: bob.cookie }), bobList.res)
    expect((bobList.body() as { projects: unknown[] }).projects).toHaveLength(1)
  })
})
