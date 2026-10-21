import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppData } from '../../state/AppDataContext'
import type { Project, RecurrenceFrequency, Task, TaskPriority, TaskRecurrence, TaskStatus } from '../../types/domain'
import { isRecurrenceConfigValid } from '../../utils/recurrence'
import { Button } from '../ui/Button'
import { Field, inputClasses } from '../ui/Field'
import { Modal } from '../ui/Modal'

const TASK_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done']
const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']
const RECURRENCE_FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly']
const FREQUENCY_LABEL: Record<RecurrenceFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}
const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

interface TaskFormModalProps {
  isOpen: boolean
  onClose: () => void
  task?: Task
  /**
   * Default project for a *new* task, and hides the picker while creating
   * (a quick "add task" from within a project shouldn't ask again). Has no
   * effect when editing an existing task — editing always shows the picker
   * so a task can be reassigned or unassigned, never permanently locked to
   * whichever project you happened to open it from.
   */
  projectId?: string
  /** Project options for the picker; required for the picker to render at all. */
  projects?: Project[]
  onSaved?: (task: Task) => void
}

interface FormState {
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string
  projectId: string
  recurrenceEnabled: boolean
  recurrenceFrequency: RecurrenceFrequency
  recurrenceWeekdays: number[]
  recurrenceDayOfMonth: string
  recurrenceEndDate: string
  reminderAt: string
}

function emptyState(projectId?: string): FormState {
  return {
    title: '',
    notes: '',
    status: 'todo',
    priority: 'medium',
    dueDate: '',
    projectId: projectId ?? '',
    recurrenceEnabled: false,
    recurrenceFrequency: 'daily',
    recurrenceWeekdays: [],
    recurrenceDayOfMonth: '',
    recurrenceEndDate: '',
    reminderAt: '',
  }
}

/** Converts a full ISO timestamp to the "YYYY-MM-DDTHH:mm" shape <input type="datetime-local"> expects, in local time. */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function stateFromTask(task: Task): FormState {
  const recurrence = task.recurrence
  return {
    title: task.title,
    notes: task.notes,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? '',
    projectId: task.projectId ?? '',
    recurrenceEnabled: Boolean(recurrence),
    recurrenceFrequency: recurrence?.frequency ?? 'daily',
    recurrenceWeekdays: recurrence?.weekdays ?? [],
    recurrenceDayOfMonth: recurrence?.dayOfMonth ? String(recurrence.dayOfMonth) : '',
    recurrenceEndDate: recurrence?.endDate ?? '',
    reminderAt: task.reminderAt ? toDatetimeLocalValue(task.reminderAt) : '',
  }
}

export function TaskFormModal({
  isOpen,
  onClose,
  task,
  projectId,
  projects = [],
  onSaved,
}: TaskFormModalProps) {
  const { addTask, updateTask } = useAppData()
  const isEditing = Boolean(task)
  const [form, setForm] = useState<FormState>(() =>
    task ? stateFromTask(task) : emptyState(projectId),
  )
  const [titleError, setTitleError] = useState<string | null>(null)
  const [dueDateError, setDueDateError] = useState<string | null>(null)
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setForm(task ? stateFromTask(task) : emptyState(projectId))
      setTitleError(null)
      setDueDateError(null)
      setRecurrenceError(null)
    }
  }, [isOpen, task, projectId])

  const toggleWeekday = (day: number) => {
    setForm((f) => ({
      ...f,
      recurrenceWeekdays: f.recurrenceWeekdays.includes(day)
        ? f.recurrenceWeekdays.filter((d) => d !== day)
        : [...f.recurrenceWeekdays, day].sort((a, b) => a - b),
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const trimmedTitle = form.title.trim()
    let hasError = false
    if (!trimmedTitle) {
      setTitleError('Task title is required.')
      hasError = true
    } else {
      setTitleError(null)
    }

    let recurrence: TaskRecurrence | undefined
    if (form.recurrenceEnabled) {
      if (!form.dueDate) {
        setDueDateError('Recurring tasks need a due date.')
        hasError = true
      } else {
        setDueDateError(null)
      }

      if (form.recurrenceFrequency === 'monthly') {
        const day = Number(form.recurrenceDayOfMonth)
        if (!form.recurrenceDayOfMonth || day < 1 || day > 31) {
          setRecurrenceError('Choose a day of the month between 1 and 31.')
          hasError = true
        }
      }
      if (form.recurrenceEndDate && form.dueDate && form.recurrenceEndDate < form.dueDate) {
        setRecurrenceError('The recurrence end date must be on or after the due date.')
        hasError = true
      }
      if (!hasError) {
        setRecurrenceError(null)
        recurrence = {
          frequency: form.recurrenceFrequency,
          weekdays: form.recurrenceFrequency === 'weekly' ? form.recurrenceWeekdays : undefined,
          dayOfMonth:
            form.recurrenceFrequency === 'monthly' ? Number(form.recurrenceDayOfMonth) : undefined,
          endDate: form.recurrenceEndDate || undefined,
        }
        if (!isRecurrenceConfigValid(recurrence)) {
          setRecurrenceError('This recurrence isn’t configured correctly.')
          hasError = true
        }
      }
    } else {
      setDueDateError(null)
      setRecurrenceError(null)
    }

    if (hasError) return

    setSubmitting(true)
    try {
      const payload = {
        title: trimmedTitle,
        notes: form.notes.trim(),
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        // Editing always respects whatever the (always-visible) picker says,
        // so a task can be moved or unassigned. Only a brand-new task
        // created from within a project defaults to — and stays locked to —
        // that project.
        projectId: isEditing ? form.projectId || undefined : (projectId ?? (form.projectId || undefined)),
        recurrence,
        reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : undefined,
      }
      const saved =
        isEditing && task ? await updateTask(task.id, payload) : await addTask(payload)
      onSaved?.(saved)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={isEditing ? 'Edit task' : 'Add task'} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Title" error={titleError ?? undefined}>
          <input
            className={inputClasses}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Draft the weekly review"
          />
        </Field>
        <Field label="Notes">
          <textarea
            className={inputClasses}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select
              className={inputClasses}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'in-progress' ? 'In progress' : s === 'todo' ? 'To do' : 'Done'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              className={inputClasses}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Due date" error={dueDateError ?? undefined}>
          <input
            type="date"
            className={inputClasses}
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
          />
        </Field>
        <Field label="Reminder (optional)">
          <input
            type="datetime-local"
            className={inputClasses}
            value={form.reminderAt}
            onChange={(e) => setForm((f) => ({ ...f, reminderAt: e.target.value }))}
          />
        </Field>
        {(isEditing || !projectId) && projects.length > 0 && (
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

        <div className="mb-3 rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={form.recurrenceEnabled}
              onChange={(e) => setForm((f) => ({ ...f, recurrenceEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-brand"
            />
            Repeat this task
          </label>

          {form.recurrenceEnabled && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex gap-1 rounded-lg border border-border bg-canvas p-1">
                {RECURRENCE_FREQUENCIES.map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, recurrenceFrequency: freq }))}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      form.recurrenceFrequency === freq
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                    aria-pressed={form.recurrenceFrequency === freq}
                  >
                    {FREQUENCY_LABEL[freq]}
                  </button>
                ))}
              </div>

              {form.recurrenceFrequency === 'weekly' && (
                <div>
                  <span className="mb-1 block text-xs font-medium text-ink">
                    On these days (leave empty to repeat weekly on the due date's weekday)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleWeekday(opt.value)}
                        aria-pressed={form.recurrenceWeekdays.includes(opt.value)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          form.recurrenceWeekdays.includes(opt.value)
                            ? 'bg-brand text-white'
                            : 'bg-canvas text-ink-soft hover:text-ink'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {form.recurrenceFrequency === 'monthly' && (
                <Field label="Day of month" error={recurrenceError ?? undefined}>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className={inputClasses}
                    value={form.recurrenceDayOfMonth}
                    onChange={(e) => setForm((f) => ({ ...f, recurrenceDayOfMonth: e.target.value }))}
                    placeholder="e.g. 15"
                  />
                </Field>
              )}
              {form.recurrenceFrequency !== 'monthly' && recurrenceError && (
                <p role="alert" className="text-xs text-danger">
                  {recurrenceError}
                </p>
              )}

              <Field label="Ends (optional)">
                <input
                  type="date"
                  className={inputClasses}
                  value={form.recurrenceEndDate}
                  onChange={(e) => setForm((f) => ({ ...f, recurrenceEndDate: e.target.value }))}
                />
              </Field>
            </div>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {isEditing ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
