import { describe, expect, it } from 'vitest'
import { normalizeTag, resolveNoteColor, resolveTagColor } from './tags'
import { colorForKey, resolveProjectColor } from './colors'
import type { Note, Project, TagColor } from '../types/domain'

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Untitled',
    content: '',
    tags: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Project',
    description: '',
    status: 'active',
    color: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('normalizeTag', () => {
  it('trims and lowercases', () => {
    expect(normalizeTag('  Work  ')).toBe('work')
  })
})

describe('resolveTagColor', () => {
  it('falls back to the deterministic default when there is no override', () => {
    expect(resolveTagColor([], 'work')).toBe(colorForKey('work'))
  })

  it('is stable across reloads for the same tag (same input, same output)', () => {
    const a = resolveTagColor([], 'personal')
    const b = resolveTagColor([], 'personal')
    expect(a).toBe(b)
  })

  it('uses a stored override when one exists', () => {
    const override: TagColor = { id: 'work', color: 'rose', createdAt: '', updatedAt: '' }
    expect(resolveTagColor([override], 'work')).toBe('rose')
  })

  it('matches overrides by normalized tag text', () => {
    const override: TagColor = { id: 'work', color: 'rose', createdAt: '', updatedAt: '' }
    expect(resolveTagColor([override], '  WORK  ')).toBe('rose')
  })
})

describe('resolveNoteColor', () => {
  it('uses the project colour when the note has a project, regardless of tags', () => {
    const project = makeProject({ id: 'proj-1', color: 'amber' })
    const note = makeNote({ tags: ['work', 'ideas'] })
    expect(resolveNoteColor(note, project, [])).toBe('amber')
  })

  it("uses the first tag's colour when there is no project", () => {
    const note = makeNote({ tags: ['work', 'ideas'] })
    expect(resolveNoteColor(note, undefined, [])).toBe(colorForKey('work'))
  })

  it('follows stable tag order — the first tag wins even if a later tag has an explicit override', () => {
    const note = makeNote({ tags: ['work', 'ideas'] })
    const override: TagColor = { id: 'ideas', color: 'red', createdAt: '', updatedAt: '' }
    expect(resolveNoteColor(note, undefined, [override])).toBe(colorForKey('work'))
    expect(resolveNoteColor(note, undefined, [override])).not.toBe('red')
  })

  it("respects the first tag's own explicit override", () => {
    const note = makeNote({ tags: ['work', 'ideas'] })
    const override: TagColor = { id: 'work', color: 'red', createdAt: '', updatedAt: '' }
    expect(resolveNoteColor(note, undefined, [override])).toBe('red')
  })

  it('falls back to a colour derived from the note id when there is no project and no tags', () => {
    const note = makeNote({ id: 'note-abc', tags: [] })
    expect(resolveNoteColor(note, undefined, [])).toBe(colorForKey('note-abc'))
  })

  it('is deterministic for the same note/project/tagColors', () => {
    const note = makeNote({ id: 'note-xyz', tags: [] })
    const a = resolveNoteColor(note, undefined, [])
    const b = resolveNoteColor(note, undefined, [])
    expect(a).toBe(b)
  })

  it('project priority wins even when the project itself has an automatic (unset) colour', () => {
    const project = makeProject({ id: 'proj-2', color: '' })
    const note = makeNote({ tags: ['work'] })
    expect(resolveNoteColor(note, project, [])).toBe(resolveProjectColor(project))
    expect(resolveNoteColor(note, project, [])).not.toBe(colorForKey('work'))
  })
})
