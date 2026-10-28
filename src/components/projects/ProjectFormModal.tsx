import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppData } from '../../state/AppDataContext'
import type { Project, ProjectColor, ProjectPriority, ProjectStatus } from '../../types/domain'
import { Button } from '../ui/Button'
import { ColorSwatchPicker } from '../ui/ColorSwatch'
import { Field, inputClasses } from '../ui/Field'
import { Modal } from '../ui/Modal'

const PROJECT_STATUSES: ProjectStatus[] = ['active', 'paused', 'completed', 'archived']
const PROJECT_PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high']

interface ProjectFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** When provided, the form edits this project instead of creating a new one. */
  project?: Project
  onSaved?: (project: Project) => void
}

interface FormState {
  name: string
  description: string
  status: ProjectStatus
  priority: ProjectPriority
  startDate: string
  targetDate: string
  /** '' means "automatic" — left this way, the project's colour is derived from its own id (see resolveProjectColor) rather than a value frozen into storage. */
  color: ProjectColor | ''
}

function emptyState(): FormState {
  return {
    name: '',
    description: '',
    status: 'active',
    priority: 'medium',
    startDate: '',
    targetDate: '',
    color: '',
  }
}

function stateFromProject(project: Project): FormState {
  return {
    name: project.name,
    description: project.description,
    status: project.status,
    priority: project.priority ?? 'medium',
    startDate: project.startDate ?? '',
    targetDate: project.targetDate ?? '',
    color: project.color,
  }
}

export function ProjectFormModal({ isOpen, onClose, project, onSaved }: ProjectFormModalProps) {
  const { addProject, updateProject } = useAppData()
  const isEditing = Boolean(project)
  const [form, setForm] = useState<FormState>(() => (project ? stateFromProject(project) : emptyState()))
  const [nameError, setNameError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setForm(project ? stateFromProject(project) : emptyState())
      setNameError(null)
      setDateError(null)
    }
  }, [isOpen, project])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const trimmedName = form.name.trim()
    let hasError = false
    if (!trimmedName) {
      setNameError('Project name is required.')
      hasError = true
    } else {
      setNameError(null)
    }

    if (form.startDate && form.targetDate && form.targetDate < form.startDate) {
      setDateError('Deadline cannot be before the start date.')
      hasError = true
    } else {
      setDateError(null)
    }

    if (hasError) return

    setSubmitting(true)
    try {
      const payload = {
        name: trimmedName,
        description: form.description.trim(),
        status: form.status,
        priority: form.priority,
        startDate: form.startDate || undefined,
        targetDate: form.targetDate || undefined,
        color: form.color,
      }
      const saved = isEditing && project
        ? await updateProject(project.id, payload)
        : await addProject(payload)
      onSaved?.(saved)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={isEditing ? 'Edit project' : 'Create project'} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Name" error={nameError ?? undefined}>
          <input
            className={inputClasses}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Home renovation"
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputClasses}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select
              className={inputClasses}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              className={inputClasses}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as ProjectPriority }))}
            >
              {PROJECT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input
              type="date"
              className={inputClasses}
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </Field>
          <Field label="Deadline" error={dateError ?? undefined}>
            <input
              type="date"
              className={inputClasses}
              value={form.targetDate}
              onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Colour">
          <div className="flex flex-wrap items-center gap-3">
            <ColorSwatchPicker
              value={form.color}
              aria-label="Project colour"
              onChange={(c: ProjectColor) => setForm((f) => ({ ...f, color: c }))}
            />
            {form.color && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: '' }))}
                className="text-xs font-medium text-ink-soft hover:text-ink hover:underline"
              >
                Use automatic colour
              </button>
            )}
          </div>
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {isEditing ? 'Save changes' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
