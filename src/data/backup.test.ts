import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import {
  clearAllRealData,
  createBackup,
  decideMergeAction,
  previewRestore,
  restoreBackup,
  validateBackup,
} from './backup'
import { dailyPlansRepo } from './dailyPlans'
import { focusSessionsRepo } from './focusSessions'
import { notesRepo } from './notes'
import { projectsRepo } from './projects'
import { tasksRepo } from './tasks'
import { weeklyReviewsRepo } from './weeklyReviews'
import { createRepository } from './repository'
import { STORE_NAMES, getDb } from './db'
import { BACKUP_FORMAT, BACKUP_VERSION } from '../types/backup'
import type { BackupData, LifeGridBackup } from '../types/backup'
import type { DailyPlan, Project, Task, WeeklyReview } from '../types/domain'

function makeProjectFixture(overrides: Partial<Project> & { id: string }): Project {
  const now = new Date().toISOString()
  return {
    createdAt: now,
    updatedAt: now,
    name: 'Fixture project',
    description: '',
    status: 'active',
    color: 'violet',
    ...overrides,
  }
}

function makeTaskFixture(overrides: Partial<Task> & { id: string }): Task {
  const now = new Date().toISOString()
  return {
    createdAt: now,
    updatedAt: now,
    title: 'Fixture task',
    notes: '',
    status: 'todo',
    priority: 'medium',
    ...overrides,
  }
}

const dailyPlanRaw = createRepository<DailyPlan>('dailyPlans')
const weeklyReviewRaw = createRepository<WeeklyReview>('weeklyReviews')

async function clearAllRecords() {
  const [projects, tasks, notes, sessions, plans, reviews] = await Promise.all([
    projectsRepo.list(),
    tasksRepo.list(),
    notesRepo.list(),
    focusSessionsRepo.list(),
    dailyPlansRepo.list(),
    weeklyReviewsRepo.list(),
  ])
  await Promise.all([
    projectsRepo.removeMany(projects.map((p) => p.id)),
    tasksRepo.removeMany(tasks.map((t) => t.id)),
    notesRepo.removeMany(notes.map((n) => n.id)),
    focusSessionsRepo.removeMany(sessions.map((s) => s.id)),
    dailyPlanRaw.removeMany(plans.map((p) => p.id)),
    weeklyReviewRaw.removeMany(reviews.map((r) => r.id)),
  ])
}

function emptyBackupData(): BackupData {
  return { projects: [], tasks: [], notes: [], focusSessions: [], dailyPlans: [], weeklyReviews: [] }
}

function makeBackup(overrides: Partial<LifeGridBackup> = {}): LifeGridBackup {
  const data = emptyBackupData()
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    dbVersion: 2,
    includesDemoData: false,
    counts: { projects: 0, tasks: 0, notes: 0, focusSessions: 0, dailyPlans: 0, weeklyReviews: 0 },
    data,
    ...overrides,
  }
}

beforeEach(async () => {
  await clearAllRecords()
})

describe('createBackup', () => {
  it('contains every supported store, even when empty', async () => {
    const backup = await createBackup({ includeDemoData: true })
    expect(Object.keys(backup.data).sort()).toEqual(
      ['dailyPlans', 'focusSessions', 'notes', 'projects', 'tasks', 'weeklyReviews'].sort(),
    )
    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.version).toBe(BACKUP_VERSION)
  })

  it('preserves entity IDs and relationships across stores', async () => {
    const project = await projectsRepo.create({ name: 'Kitchen' })
    const task = await tasksRepo.create({ title: 'Buy tiles', projectId: project.id })
    await notesRepo.create({ title: 'Tile ideas', projectId: project.id })
    await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25, projectId: project.id, taskId: task.id })

    const backup = await createBackup({ includeDemoData: true })
    expect(backup.data.projects[0].id).toBe(project.id)
    expect(backup.data.tasks[0].projectId).toBe(project.id)
    expect(backup.data.notes[0].projectId).toBe(project.id)
    expect(backup.data.focusSessions[0].projectId).toBe(project.id)
    expect(backup.data.focusSessions[0].taskId).toBe(task.id)
    // In-progress timer bookkeeping must survive the export untouched.
    expect(backup.data.focusSessions[0].status).toBe('active')
    expect(backup.data.focusSessions[0].accumulatedMs).toBe(0)
  })

  it('excludes demo data by default, and includes it only when explicitly requested', async () => {
    await projectsRepo.create({ name: 'Real project', isDemo: false })
    await projectsRepo.create({ name: 'Sample project', isDemo: true })

    const defaultBackup = await createBackup({ includeDemoData: false })
    expect(defaultBackup.data.projects).toHaveLength(1)
    expect(defaultBackup.data.projects[0].name).toBe('Real project')
    expect(defaultBackup.includesDemoData).toBe(false)

    const fullBackup = await createBackup({ includeDemoData: true })
    expect(fullBackup.data.projects).toHaveLength(2)
    expect(fullBackup.includesDemoData).toBe(true)
  })

  it('counts match the actual record counts', async () => {
    await projectsRepo.create({ name: 'A' })
    await projectsRepo.create({ name: 'B' })
    const backup = await createBackup({ includeDemoData: true })
    expect(backup.counts.projects).toBe(2)
  })
})

describe('validateBackup', () => {
  it('rejects a value that is not an object', () => {
    const result = validateBackup('not json data')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects an unrecognized format', () => {
    const result = validateBackup({ ...makeBackup(), format: 'some-other-app-backup' })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /not a Life Grid backup/i.test(e))).toBe(true)
  })

  it('rejects an unsupported backup version', () => {
    const result = validateBackup({ ...makeBackup(), version: 999 })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /unsupported backup version/i.test(e))).toBe(true)
  })

  it('rejects a backup from a newer, unsupported database schema', () => {
    const result = validateBackup({ ...makeBackup(), dbVersion: 999 })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /newer version of Life Grid/i.test(e))).toBe(true)
  })

  it('rejects a record missing required fields', () => {
    const backup = makeBackup({
      data: { ...emptyBackupData(), projects: [{ id: 'p1', createdAt: 'x', updatedAt: 'x' } as never] },
    })
    const result = validateBackup(backup)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('projects[0]'))).toBe(true)
  })

  it('rejects duplicate ids within the same store', () => {
    const project = makeProjectFixture({ id: 'dup-id', name: 'A' })
    const backup = makeBackup({ data: { ...emptyBackupData(), projects: [project, { ...project, name: 'B' }] } })
    const result = validateBackup(backup)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /duplicate id/i.test(e))).toBe(true)
  })

  it('accepts a well-formed backup and warns (without rejecting) about dangling relationships', () => {
    const task = makeTaskFixture({ id: 't1', title: 'Orphaned task', projectId: 'missing-project' })
    const backup = makeBackup({ data: { ...emptyBackupData(), tasks: [task] } })
    const result = validateBackup(backup)
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => /reference a project not included/i.test(w))).toBe(true)
  })

  it('round-trips a real export through validation', async () => {
    await projectsRepo.create({ name: 'Round trip' })
    const backup = await createBackup({ includeDemoData: true })
    const result = validateBackup(JSON.parse(JSON.stringify(backup)))
    expect(result.valid).toBe(true)
    expect(result.backup?.data.projects[0].name).toBe('Round trip')
  })

  it('rejects a task with a malformed recurrence frequency', () => {
    const task = makeTaskFixture({ id: 't1', recurrence: { frequency: 'yearly' } as never })
    const backup = makeBackup({ data: { ...emptyBackupData(), tasks: [task] } })
    const result = validateBackup(backup)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /invalid "frequency"/i.test(e))).toBe(true)
  })

  it('rejects a task with an out-of-range monthly dayOfMonth', () => {
    const task = makeTaskFixture({ id: 't1', recurrence: { frequency: 'monthly', dayOfMonth: 40 } })
    const backup = makeBackup({ data: { ...emptyBackupData(), tasks: [task] } })
    const result = validateBackup(backup)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /invalid "dayOfMonth"/i.test(e))).toBe(true)
  })

  it('rejects a task with a malformed weekdays list', () => {
    const task = makeTaskFixture({ id: 't1', recurrence: { frequency: 'weekly', weekdays: [1, 9] } })
    const backup = makeBackup({ data: { ...emptyBackupData(), tasks: [task] } })
    const result = validateBackup(backup)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /invalid "weekdays"/i.test(e))).toBe(true)
  })

  it('accepts a well-formed recurring task with a reminder and recurrenceParentId', () => {
    const task = makeTaskFixture({
      id: 't1',
      dueDate: '2026-03-10',
      recurrence: { frequency: 'weekly', weekdays: [1, 3] },
      reminderAt: '2026-03-10T09:00:00.000Z',
      recurrenceParentId: 'parent-1',
    })
    const backup = makeBackup({ data: { ...emptyBackupData(), tasks: [task] } })
    const result = validateBackup(backup)
    expect(result.valid).toBe(true)
  })

  it('round-trips recurrence metadata and reminders through a real export', async () => {
    const original = await tasksRepo.create({
      title: 'Water plants',
      dueDate: '2026-03-10',
      recurrence: { frequency: 'monthly', dayOfMonth: 15 },
      reminderAt: '2026-03-10T09:00:00.000Z',
    })
    const { nextOccurrence } = await tasksRepo.completeTask(original.id)

    const backup = await createBackup({ includeDemoData: true })
    const result = validateBackup(JSON.parse(JSON.stringify(backup)))
    expect(result.valid).toBe(true)

    const exportedNext = result.backup?.data.tasks.find((t) => t.id === nextOccurrence!.id)
    expect(exportedNext?.recurrence).toEqual({ frequency: 'monthly', dayOfMonth: 15 })
    expect(exportedNext?.recurrenceParentId).toBe(original.id)

    const exportedOriginal = result.backup?.data.tasks.find((t) => t.id === original.id)
    expect(exportedOriginal?.reminderAt).toBe('2026-03-10T09:00:00.000Z')
    expect(exportedOriginal?.status).toBe('done')
  })
})

describe('decideMergeAction', () => {
  const now = '2026-01-05T10:00:00.000Z'
  const earlier = '2026-01-01T10:00:00.000Z'
  const later = '2026-01-10T10:00:00.000Z'

  it('adds a record that does not exist yet', () => {
    expect(decideMergeAction({ id: 'a', createdAt: now, updatedAt: now }, undefined)).toBe('add')
  })

  it('updates when the incoming record is newer', () => {
    const existing = { id: 'a', createdAt: now, updatedAt: earlier }
    const incoming = { id: 'a', createdAt: now, updatedAt: later }
    expect(decideMergeAction(incoming, existing)).toBe('update')
  })

  it('skips when the incoming record is older or equal', () => {
    const existing = { id: 'a', createdAt: now, updatedAt: later }
    const incoming = { id: 'a', createdAt: now, updatedAt: earlier }
    expect(decideMergeAction(incoming, existing)).toBe('skip')
  })

  it('never lets a demo record overwrite a real one, even if newer', () => {
    const existing = { id: 'a', createdAt: now, updatedAt: earlier, isDemo: false }
    const incoming = { id: 'a', createdAt: now, updatedAt: later, isDemo: true }
    expect(decideMergeAction(incoming, existing)).toBe('skip')
  })
})

describe('restoreBackup — merge', () => {
  it('preserves unrelated existing records', async () => {
    await projectsRepo.create({ name: 'Keep me' })
    const backup = makeBackup({
      data: {
        ...emptyBackupData(),
        projects: [makeProjectFixture({ id: 'new-1', name: 'From backup', color: 'teal' })],
      },
    })

    await restoreBackup(backup, 'merge')

    const all = await projectsRepo.list()
    expect(all.map((p) => p.name).sort()).toEqual(['From backup', 'Keep me'])
  })

  it('updates a record when the backup version is newer', async () => {
    const project = await projectsRepo.create({ name: 'Original' })
    const newerVersion = {
      ...project,
      name: 'Updated via backup',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    }
    const backup = makeBackup({ data: { ...emptyBackupData(), projects: [newerVersion] } })

    await restoreBackup(backup, 'merge')

    const stored = await projectsRepo.get(project.id)
    expect(stored?.name).toBe('Updated via backup')
  })

  it('does not let an incoming demo record overwrite a real one', async () => {
    const project = await projectsRepo.create({ name: 'Real data', isDemo: false })
    const demoVersion = {
      ...project,
      name: 'Should not win',
      isDemo: true,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    }
    const backup = makeBackup({ data: { ...emptyBackupData(), projects: [demoVersion] } })

    await restoreBackup(backup, 'merge')

    const stored = await projectsRepo.get(project.id)
    expect(stored?.name).toBe('Real data')
  })
})

describe('restoreBackup — replace', () => {
  it('replaces existing data with exactly the backup contents', async () => {
    await projectsRepo.create({ name: 'Old data' })
    const backup = makeBackup({
      data: {
        ...emptyBackupData(),
        projects: [makeProjectFixture({ id: 'replace-1', name: 'New data', color: 'rose' })],
      },
    })

    await restoreBackup(backup, 'replace')

    const all = await projectsRepo.list()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('New data')
  })

  it('clears stores with no corresponding backup records', async () => {
    await tasksRepo.create({ title: 'Will be wiped' })
    const backup = makeBackup() // no tasks

    await restoreBackup(backup, 'replace')

    expect(await tasksRepo.list()).toHaveLength(0)
  })
})

describe('previewRestore', () => {
  it('matches the actual outcome of restoreBackup for merge', async () => {
    await projectsRepo.create({ name: 'Existing' })
    const backup = makeBackup({
      data: {
        ...emptyBackupData(),
        projects: [makeProjectFixture({ id: 'preview-1', name: 'New from backup', color: 'amber' })],
      },
    })
    const current: BackupData = {
      ...emptyBackupData(),
      projects: await projectsRepo.list(),
    }

    const preview = previewRestore(backup, 'merge', current)
    expect(preview.projects).toEqual({ added: 1, updated: 0, skipped: 0 })

    await restoreBackup(backup, 'merge')
    const all = await projectsRepo.list()
    expect(all).toHaveLength(2)
  })
})

describe('restore atomicity', () => {
  it('leaves existing data completely untouched when the backup fails validation', async () => {
    await projectsRepo.create({ name: 'Untouched' })
    const before = await projectsRepo.list()

    const result = validateBackup({ format: 'wrong', version: 1 })
    expect(result.valid).toBe(false)

    const after = await projectsRepo.list()
    expect(after).toEqual(before)
  })

  it('aborts the whole transaction — rolling back every store — if any single write fails', async () => {
    await projectsRepo.create({ name: 'Should survive if restore fails' })
    const now = new Date().toISOString()

    const goodProject = makeProjectFixture({ id: 'ok-project', name: 'Valid project' })
    // A value IndexedDB's structured clone cannot store (a function), to force
    // the transaction to fail partway through — after the project store has
    // already received a successful put for `goodProject`.
    const unclonableTask = {
      id: 'bad-task',
      createdAt: now,
      updatedAt: now,
      title: 'Bad',
      notes: '',
      status: 'todo',
      priority: 'medium',
      brokenField: () => {},
    }

    const backup = makeBackup({
      data: { ...emptyBackupData(), projects: [goodProject], tasks: [unclonableTask] as never },
    })

    await expect(restoreBackup(backup, 'merge')).rejects.toBeTruthy()

    // The project store's put must have been rolled back along with the
    // failed task store's put — nothing from this restore should be visible.
    const projects = await projectsRepo.list()
    expect(projects.map((p) => p.name)).toEqual(['Should survive if restore fails'])
  })
})

describe('clearAllRealData', () => {
  it('deletes only non-demo records across every store, atomically', async () => {
    await projectsRepo.create({ name: 'Real', isDemo: false })
    await projectsRepo.create({ name: 'Sample', isDemo: true })
    await tasksRepo.create({ title: 'Real task', isDemo: false })
    await notesRepo.create({ title: 'Real note', isDemo: false })

    await clearAllRealData()

    const projects = await projectsRepo.list()
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe('Sample')
    expect(await tasksRepo.list()).toHaveLength(0)
    expect(await notesRepo.list()).toHaveLength(0)
  })

  it('touches every managed store', async () => {
    const db = await getDb()
    for (const store of STORE_NAMES) {
      expect(db.objectStoreNames.contains(store)).toBe(true)
    }
  })

  it('deletes an active (non-demo) focus session, so no stale running timer can survive a data clear', async () => {
    const active = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    expect(active.status).toBe('active')

    await clearAllRealData()

    expect(await focusSessionsRepo.get(active.id)).toBeUndefined()
    expect(await focusSessionsRepo.list()).toHaveLength(0)
  })
})
