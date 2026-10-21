import { api, patchForJson } from '../../lib/apiClient'
import type { Note } from '../../types/domain'
import type { CreateNoteInput } from '../notes'

export const remoteNotesRepo = {
  async list(): Promise<Note[]> {
    return (await api.get<{ notes: Note[] }>('/api/notes')).notes
  },
  async create(input: CreateNoteInput): Promise<Note> {
    return (await api.post<{ note: Note }>('/api/notes', input)).note
  },
  async update(id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>): Promise<Note> {
    return (await api.patch<{ note: Note }>(`/api/notes/${id}`, patchForJson(patch))).note
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/api/notes/${id}`)
  },
  async togglePin(id: string): Promise<Note> {
    const notes = await this.list()
    const existing = notes.find((n) => n.id === id)
    return this.update(id, { pinned: !(existing?.pinned ?? false) })
  },
}
