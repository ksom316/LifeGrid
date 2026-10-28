import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { projectsRepo } from './projects'
import { tasksRepo } from './tasks'
import { notesRepo } from './notes'
import { focusSessionsRepo } from './focusSessions'
import { clearDemoData, seedDemoData } from './demoData'
import { PALETTE_COLORS, colorForKey, resolveProjectColor } from '../utils/colors'

async function clearAllRecords() {
  const projects = await projectsRepo.list()
  await projectsRepo.removeMany(projects.map((p) => p.id))
  const tasks = await tasksRepo.list()
  await tasksRepo.removeMany(tasks.map((t) => t.id))
  const notes = await notesRepo.list()
  await notesRepo.removeMany(notes.map((n) => n.id))
  const sessions = await focusSessionsRepo.list()
  await focusSessionsRepo.removeMany(sessions.map((s) => s.id))
}

beforeEach(async () => {
  await clearAllRecords()
})

describe('projectsRepo', () => {
  it('creates a project with sensible defaults', async () => {
    const project = await projectsRepo.create({ name: '  My Project  ' })
    expect(project.name).toBe('My Project')
    expect(project.status).toBe('active')
    expect(project.priority).toBe('medium')
    expect(project.id).toBeTruthy()
    expect(project.createdAt).toBe(project.updatedAt)
  })

  it('leaves colour unset (automatic) when none is chosen, resolving to a stable id-derived default', async () => {
    const project = await projectsRepo.create({ name: 'Auto colour' })
    expect(project.color).toBe('')
    expect(PALETTE_COLORS).toContain(resolveProjectColor(project))
    expect(resolveProjectColor(project)).toBe(colorForKey(project.id))
  })

  it('respects an explicitly chosen colour instead of the deterministic default', async () => {
    const project = await projectsRepo.create({ name: 'Colour pick', color: 'rose' })
    expect(project.color).toBe('rose')
    expect(resolveProjectColor(project)).toBe('rose')
  })

  it('different projects distribute across more than one automatic colour', async () => {
    const names = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
    const created = await Promise.all(names.map((name) => projectsRepo.create({ name })))
    const colors = new Set(created.map((p) => resolveProjectColor(p)))
    expect(colors.size).toBeGreaterThan(1)
  })


  it('persists and lists created projects', async () => {
    await projectsRepo.create({ name: 'Alpha' })
    await projectsRepo.create({ name: 'Beta' })
    const all = await projectsRepo.list()
    expect(all.map((p) => p.name).sort()).toEqual(['Alpha', 'Beta'])
  })

  it('updates a project and bumps updatedAt', async () => {
    const project = await projectsRepo.create({ name: 'Original' })
    const updated = await projectsRepo.update(project.id, { name: 'Renamed' })
    expect(updated.name).toBe('Renamed')
    expect(updated.id).toBe(project.id)
  })

  it('throws when updating a project that does not exist', async () => {
    await expect(projectsRepo.update('missing-id', { name: 'x' })).rejects.toThrow()
  })

  it('an explicit colour persists across reload and is never silently overwritten', async () => {
    const project = await projectsRepo.create({ name: 'Picked', color: 'teal' })
    const reloaded = await projectsRepo.get(project.id)
    expect(reloaded?.color).toBe('teal')
  })

  it('can be reset back to automatic colour after an explicit choice', async () => {
    const project = await projectsRepo.create({ name: 'Reset me', color: 'teal' })
    expect(project.color).toBe('teal')
    const reset = await projectsRepo.update(project.id, { color: '' })
    expect(reset.color).toBe('')
    expect(resolveProjectColor(reset)).toBe(colorForKey(project.id))
  })

  it('deletes a project while preserving and unassigning its tasks, notes, and focus sessions', async () => {
    const project = await projectsRepo.create({ name: 'Doomed project' })
    const otherProject = await projectsRepo.create({ name: 'Unrelated project' })

    const task = await tasksRepo.create({ title: 'Keep me', projectId: project.id })
    const note = await notesRepo.create({ title: 'Keep me too', projectId: project.id })
    const session = await focusSessionsRepo.create({ durationMinutes: 10, projectId: project.id })
    const otherTask = await tasksRepo.create({ title: 'Unrelated task', projectId: otherProject.id })

    await projectsRepo.deletePreservingRecords(project.id)

    expect(await projectsRepo.get(project.id)).toBeUndefined()

    const survivingTask = await tasksRepo.get(task.id)
    expect(survivingTask).toBeDefined()
    expect(survivingTask?.projectId).toBeUndefined()

    const survivingNote = await notesRepo.get(note.id)
    expect(survivingNote?.projectId).toBeUndefined()

    const survivingSession = await focusSessionsRepo.get(session.id)
    expect(survivingSession?.projectId).toBeUndefined()

    const untouchedTask = await tasksRepo.get(otherTask.id)
    expect(untouchedTask?.projectId).toBe(otherProject.id)
  })
})

describe('tasksRepo', () => {
  it('toggles a task between todo and done', async () => {
    const task = await tasksRepo.create({ title: 'Write tests' })
    expect(task.status).toBe('todo')

    const done = await tasksRepo.toggleDone(task.id)
    expect(done.status).toBe('done')
    expect(done.completedAt).toBeTruthy()

    const reopened = await tasksRepo.toggleDone(task.id)
    expect(reopened.status).toBe('todo')
    expect(reopened.completedAt).toBeUndefined()
  })
})

describe('demo data', () => {
  it('seeds the demo project with an automatic colour rather than a hardcoded one', async () => {
    await seedDemoData()
    const all = await projectsRepo.list()
    const demoProject = all.find((p) => p.isDemo)
    expect(demoProject?.color).toBe('')
  })

  it('seeds demo records and removes only those tagged isDemo', async () => {
    await projectsRepo.create({ name: 'Real project' })
    await seedDemoData()

    const beforeClear = await projectsRepo.list()
    expect(beforeClear.length).toBeGreaterThan(1)

    await clearDemoData()

    const afterClear = await projectsRepo.list()
    expect(afterClear).toHaveLength(1)
    expect(afterClear[0].name).toBe('Real project')
    expect(afterClear.every((p) => !p.isDemo)).toBe(true)
  })
})
