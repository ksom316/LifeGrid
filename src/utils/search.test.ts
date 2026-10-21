import { describe, expect, it } from 'vitest'
import { searchAll } from './search'
import type { Note, Project, Task } from '../types/domain'

let counter = 0
function makeProject(overrides: Partial<Project> = {}): Project {
  counter += 1
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: `project-${counter}`,
    createdAt: now,
    updatedAt: now,
    name: 'Untitled project',
    description: '',
    status: 'active',
    color: 'violet',
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: `task-${counter}`,
    createdAt: now,
    updatedAt: now,
    title: 'Untitled task',
    notes: '',
    status: 'todo',
    priority: 'medium',
    ...overrides,
  }
}

function makeNote(overrides: Partial<Note> = {}): Note {
  counter += 1
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: `note-${counter}`,
    createdAt: now,
    updatedAt: now,
    title: 'Untitled note',
    content: '',
    tags: [],
    ...overrides,
  }
}

const empty = { projects: [], tasks: [], notes: [] }

describe('searchAll — basic matching', () => {
  it('matches case-insensitively', () => {
    const project = makeProject({ name: 'Kitchen Remodel' })
    const results = searchAll({ ...empty, projects: [project] }, 'KITCHEN')
    expect(results.map((r) => r.id)).toContain(project.id)
  })

  it('trims whitespace from the query', () => {
    const project = makeProject({ name: 'Kitchen Remodel' })
    const results = searchAll({ ...empty, projects: [project] }, '  kitchen  ')
    expect(results.map((r) => r.id)).toContain(project.id)
  })

  it('matches a partial word substring', () => {
    const project = makeProject({ name: 'Kitchen Remodel' })
    const results = searchAll({ ...empty, projects: [project] }, 'remod')
    expect(results.map((r) => r.id)).toContain(project.id)
  })

  it('matches across multiple words without requiring an exact phrase', () => {
    const task = makeTask({ title: 'Buy ceramic tiles for the kitchen floor' })
    const results = searchAll({ ...empty, tasks: [task] }, 'kitchen tiles')
    expect(results.map((r) => r.id)).toContain(task.id)
  })

  it('does not match when only some of the words are present', () => {
    const task = makeTask({ title: 'Buy ceramic tiles' })
    const results = searchAll({ ...empty, tasks: [task] }, 'tiles spaceship')
    expect(results.map((r) => r.id)).not.toContain(task.id)
  })

  it('returns nothing for an empty or whitespace-only query', () => {
    const project = makeProject({ name: 'Anything' })
    expect(searchAll({ ...empty, projects: [project] }, '')).toEqual([])
    expect(searchAll({ ...empty, projects: [project] }, '   ')).toEqual([])
  })

  it('returns no results when nothing matches', () => {
    const project = makeProject({ name: 'Kitchen Remodel' })
    const results = searchAll({ ...empty, projects: [project] }, 'spaceship')
    expect(results).toEqual([])
  })
})

describe('searchAll — entity coverage', () => {
  it('searches project name and description', () => {
    const byName = makeProject({ name: 'Garden project' })
    const byDescription = makeProject({ name: 'Other', description: 'Involves a garden overhaul' })
    const results = searchAll({ ...empty, projects: [byName, byDescription] }, 'garden')
    expect(results.map((r) => r.id).sort()).toEqual([byDescription.id, byName.id].sort())
  })

  it('searches task title and notes, including linked project context', () => {
    const project = makeProject({ name: 'Home Office' })
    const task = makeTask({ title: 'Assemble desk', notes: 'Needs an Allen key', projectId: project.id })
    const results = searchAll({ projects: [project], tasks: [task], notes: [] }, 'allen')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('task')
    expect(results[0].context).toContain('Home Office')
  })

  it('searches note title, content, and tags, including linked project context', () => {
    const project = makeProject({ name: 'Trip Planning' })
    const note = makeNote({
      title: 'Packing list',
      content: 'Remember sunscreen and a hat',
      tags: ['travel', 'summer'],
      projectId: project.id,
    })
    const byContent = searchAll({ projects: [project], tasks: [], notes: [note] }, 'sunscreen')
    expect(byContent).toHaveLength(1)
    expect(byContent[0].context).toContain('Trip Planning')

    const byTag = searchAll({ projects: [project], tasks: [], notes: [note] }, 'travel')
    expect(byTag).toHaveLength(1)
    expect(byTag[0].id).toBe(note.id)
  })

  it('finds matches across all three entity types in one query', () => {
    const project = makeProject({ name: 'Ocean cleanup' })
    const task = makeTask({ title: 'Ocean survey' })
    const note = makeNote({ title: 'Ocean notes' })
    const results = searchAll({ projects: [project], tasks: [task], notes: [note] }, 'ocean')
    expect(results.map((r) => r.type).sort()).toEqual(['note', 'project', 'task'])
  })
})

describe('searchAll — ranking', () => {
  it('ranks an exact title match above a prefix match', () => {
    const exact = makeProject({ name: 'Launch' })
    const prefix = makeProject({ name: 'Launch Plan' })
    const results = searchAll({ ...empty, projects: [exact, prefix] }, 'launch')
    expect(results[0].id).toBe(exact.id)
  })

  it('ranks a title prefix match above a mid-title substring match', () => {
    const prefix = makeProject({ name: 'Website redesign' })
    const substring = makeProject({ name: 'Company website' })
    const results = searchAll({ ...empty, projects: [prefix, substring] }, 'website')
    expect(results[0].id).toBe(prefix.id)
  })

  it('ranks any title match above a description-only match', () => {
    const titleMatch = makeProject({ name: 'Budget' })
    const descriptionMatch = makeProject({ name: 'Finance', description: 'Annual budget review' })
    const results = searchAll({ ...empty, projects: [titleMatch, descriptionMatch] }, 'budget')
    expect(results[0].id).toBe(titleMatch.id)
  })

  it('produces a plain-text snippet for a content-only match', () => {
    const note = makeNote({
      title: 'Random title',
      content: 'A long block of text that mentions pineapple somewhere in the middle of it all',
    })
    const results = searchAll({ ...empty, notes: [note] }, 'pineapple')
    expect(results[0].snippet).toBeTruthy()
    expect(results[0].snippet).not.toMatch(/<[^>]+>/) // never contains HTML markup
  })

  it('never returns duplicate results for the same record', () => {
    const task = makeTask({ title: 'Repeat repeat task', notes: 'repeat repeat in notes too' })
    const results = searchAll({ ...empty, tasks: [task] }, 'repeat')
    expect(results.filter((r) => r.id === task.id)).toHaveLength(1)
  })
})

describe('searchAll — demo data', () => {
  it('includes demo records but ranks them below an equally strong real match', () => {
    const real = makeProject({ name: 'Launch', isDemo: false })
    const demo = makeProject({ name: 'Launch', isDemo: true })
    const results = searchAll({ ...empty, projects: [real, demo] }, 'launch')
    expect(results).toHaveLength(2)
    expect(results[0].id).toBe(real.id)
    expect(results[0].isDemo).toBe(false)
    expect(results[1].isDemo).toBe(true)
  })

  it('flags demo records so the UI can label them', () => {
    const demo = makeProject({ name: 'Sample project', isDemo: true })
    const results = searchAll({ ...empty, projects: [demo] }, 'sample')
    expect(results[0].isDemo).toBe(true)
  })
})
