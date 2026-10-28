import { createId, createRepository, nowISO } from './repository'
import type { Note } from '../types/domain'

const repo = createRepository<Note>('notes')

export interface CreateNoteInput {
  title: string
  content?: string
  tags?: string[]
  projectId?: string
  pinned?: boolean
  autocorrect?: boolean
  isDemo?: boolean
}

/** Reads a note's pinned state, defaulting to false for records created before pinning existed. */
export function notePinned(note: Note): boolean {
  return note.pinned ?? false
}

/** Reads a note's auto-correct setting, defaulting to true (enabled) for records created before this existed. */
export function noteAutocorrectEnabled(note: Note): boolean {
  return note.autocorrect ?? true
}

export const notesRepo = {
  list: repo.list,
  get: repo.get,
  remove: repo.remove,
  removeMany: repo.removeMany,

  async create(input: CreateNoteInput): Promise<Note> {
    const timestamp = nowISO()
    const note: Note = {
      id: createId(),
      title: input.title.trim(),
      content: input.content?.trim() ?? '',
      tags: input.tags ?? [],
      projectId: input.projectId,
      pinned: input.pinned ?? false,
      autocorrect: input.autocorrect ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
      isDemo: input.isDemo,
    }
    return repo.put(note)
  },

  async update(id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>): Promise<Note> {
    const existing = await repo.get(id)
    if (!existing) throw new Error(`Note ${id} not found`)
    const updated: Note = { ...existing, ...patch, updatedAt: nowISO() }
    return repo.put(updated)
  },

  async togglePin(id: string): Promise<Note> {
    const existing = await repo.get(id)
    if (!existing) throw new Error(`Note ${id} not found`)
    return this.update(id, { pinned: !notePinned(existing) })
  },
}
