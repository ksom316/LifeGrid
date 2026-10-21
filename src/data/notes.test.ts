import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { notePinned, notesRepo } from './notes'
import { projectsRepo } from './projects'
import { clearDemoData, seedDemoData } from './demoData'

async function clearAllRecords() {
  const notes = await notesRepo.list()
  await notesRepo.removeMany(notes.map((n) => n.id))
  const projects = await projectsRepo.list()
  await projectsRepo.removeMany(projects.map((p) => p.id))
}

beforeEach(async () => {
  await clearAllRecords()
})

describe('notesRepo', () => {
  it('creates a note with sensible defaults', async () => {
    const note = await notesRepo.create({ title: '  My Note  ' })
    expect(note.title).toBe('My Note')
    expect(note.content).toBe('')
    expect(note.tags).toEqual([])
    expect(notePinned(note)).toBe(false)
    expect(note.projectId).toBeUndefined()
    expect(note.createdAt).toBe(note.updatedAt)
  })

  it('persists and lists created notes', async () => {
    await notesRepo.create({ title: 'Alpha' })
    await notesRepo.create({ title: 'Beta' })
    const all = await notesRepo.list()
    expect(all.map((n) => n.title).sort()).toEqual(['Alpha', 'Beta'])
  })

  it('updates a note and bumps updatedAt', async () => {
    const note = await notesRepo.create({ title: 'Original' })
    const updated = await notesRepo.update(note.id, { title: 'Renamed', tags: ['work'] })
    expect(updated.title).toBe('Renamed')
    expect(updated.tags).toEqual(['work'])
    expect(updated.id).toBe(note.id)
  })

  it('throws when updating a note that does not exist', async () => {
    await expect(notesRepo.update('missing-id', { title: 'x' })).rejects.toThrow()
  })

  it('toggles pin state', async () => {
    const note = await notesRepo.create({ title: 'Pin me' })
    expect(notePinned(note)).toBe(false)

    const pinned = await notesRepo.togglePin(note.id)
    expect(notePinned(pinned)).toBe(true)

    const unpinned = await notesRepo.togglePin(note.id)
    expect(notePinned(unpinned)).toBe(false)
  })

  it('links a note to a project and can remove that association', async () => {
    const project = await projectsRepo.create({ name: 'Target project' })
    const note = await notesRepo.create({ title: 'Linked note', projectId: project.id })
    expect(note.projectId).toBe(project.id)

    const unlinked = await notesRepo.update(note.id, { projectId: undefined })
    expect(unlinked.projectId).toBeUndefined()
  })

  it('deletes only the targeted note', async () => {
    const keep = await notesRepo.create({ title: 'Keep me' })
    const remove = await notesRepo.create({ title: 'Remove me' })

    await notesRepo.remove(remove.id)

    const remaining = await notesRepo.list()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(keep.id)
  })
})

describe('demo data', () => {
  it('seeds demo notes and removes only those tagged isDemo', async () => {
    await notesRepo.create({ title: 'Real note' })
    await seedDemoData()

    const beforeClear = await notesRepo.list()
    expect(beforeClear.length).toBeGreaterThan(1)

    await clearDemoData()

    const afterClear = await notesRepo.list()
    expect(afterClear).toHaveLength(1)
    expect(afterClear[0].title).toBe('Real note')
    expect(afterClear.every((n) => !n.isDemo)).toBe(true)
  })
})
