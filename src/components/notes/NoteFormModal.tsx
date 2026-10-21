import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppData } from '../../state/AppDataContext'
import type { Note, Project } from '../../types/domain'
import { Button } from '../ui/Button'
import { Field, inputClasses } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { TagInput } from './TagInput'

interface NoteFormModalProps {
  isOpen: boolean
  onClose: () => void
  note?: Note
  /** Locks the note to this project; hides the project picker. */
  projectId?: string
  /** Shown when there's no fixed projectId, so the note can optionally be assigned. */
  projects?: Project[]
  onSaved?: (note: Note) => void
}

interface FormState {
  title: string
  content: string
  tags: string[]
  projectId: string
}

function emptyState(projectId?: string): FormState {
  return { title: '', content: '', tags: [], projectId: projectId ?? '' }
}

function stateFromNote(note: Note): FormState {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags,
    projectId: note.projectId ?? '',
  }
}

export function NoteFormModal({
  isOpen,
  onClose,
  note,
  projectId,
  projects = [],
  onSaved,
}: NoteFormModalProps) {
  const { addNote, updateNote } = useAppData()
  const isEditing = Boolean(note)
  const [form, setForm] = useState<FormState>(() =>
    note ? stateFromNote(note) : emptyState(projectId),
  )
  const [titleError, setTitleError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const tagsFieldId = useId()

  useEffect(() => {
    if (isOpen) {
      setForm(note ? stateFromNote(note) : emptyState(projectId))
      setTitleError(null)
    }
  }, [isOpen, note, projectId])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const trimmedTitle = form.title.trim()
    if (!trimmedTitle) {
      setTitleError('Note title is required.')
      return
    }
    setTitleError(null)

    setSubmitting(true)
    try {
      const payload = {
        title: trimmedTitle,
        content: form.content.trim(),
        tags: form.tags,
        projectId: projectId ?? (form.projectId || undefined),
      }
      const saved =
        isEditing && note ? await updateNote(note.id, payload) : await addNote(payload)
      onSaved?.(saved)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={isEditing ? 'Edit note' : 'Create note'} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Title" error={titleError ?? undefined}>
          <input
            className={inputClasses}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Ideas for Q1"
          />
        </Field>
        <Field label="Content">
          <textarea
            className={`${inputClasses} font-mono`}
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={8}
            placeholder="Write freely — line breaks are preserved."
          />
        </Field>
        <div className="mb-3">
          <label htmlFor={tagsFieldId} className="mb-1.5 block text-xs text-ink-soft">
            Tags
          </label>
          <TagInput
            id={tagsFieldId}
            tags={form.tags}
            onChange={(tags) => setForm((f) => ({ ...f, tags }))}
          />
        </div>
        {!projectId && projects.length > 0 && (
          <Field label="Project (optional)">
            <select
              className={inputClasses}
              value={form.projectId}
              onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {isEditing ? 'Save changes' : 'Create note'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
