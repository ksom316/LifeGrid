import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../../state/AppDataContext'
import type { Project, Task, TaskPriority, TaskStatus } from '../../types/domain'
import { formatShortDate, isOverdue } from '../../utils/date'
import { describeRecurrence } from '../../utils/recurrence'
import { Badge } from '../ui/Badge'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { IconBell, IconPencil, IconRepeat, IconTrash } from '../ui/icons'
import { TaskFormModal } from './TaskFormModal'

const PRIORITY_TONE: Record<TaskPriority, 'danger' | 'warning' | 'neutral'> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  done: 'Done',
}

interface TaskCardProps {
  task: Task
  projectId: string
  projects: Project[]
  highlighted?: boolean
}

export function TaskCard({ task, projectId, projects, highlighted = false }: TaskCardProps) {
  const { updateTask, deleteTask, completeTask } = useAppData()
  const [isEditOpen, setEditOpen] = useState(false)
  const [isDeleteOpen, setDeleteOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlighted])

  const overdue = task.status !== 'done' && task.dueDate && isOverdue(task.dueDate)

  const handleStatusChange = async (nextStatus: TaskStatus) => {
    if (nextStatus === 'done') {
      // Routes through the single recurrence-aware completion path so a
      // next occurrence is generated regardless of which control (this
      // dropdown, a dashboard checkbox, etc.) marked the task done.
      await completeTask(task.id)
      return
    }
    await updateTask(task.id, {
      status: nextStatus,
      completedAt: undefined,
    })
  }

  return (
    <div
      ref={cardRef}
      id={`task-${task.id}`}
      className={`flex flex-col gap-2 rounded-xl border bg-canvas p-3 shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.25)] transition-colors hover:border-border-strong ${
        highlighted ? 'border-brand ring-2 ring-brand/40' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{task.title}</p>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label={`Edit "${task.title}"`}
            className="rounded-md p-2 text-ink-soft sm:p-1 hover:bg-surface hover:text-ink"
          >
            <IconPencil width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            aria-label={`Delete "${task.title}"`}
            className="rounded-md p-2 text-ink-soft sm:p-1 hover:bg-danger-soft hover:text-danger"
          >
            <IconTrash width={14} height={14} />
          </button>
        </div>
      </div>

      {task.notes && <p className="line-clamp-2 text-xs text-ink-soft">{task.notes}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
        {task.dueDate && (
          <Badge tone={overdue ? 'danger' : 'neutral'}>
            {overdue ? 'Overdue' : formatShortDate(task.dueDate)}
          </Badge>
        )}
        {task.recurrence && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink-soft"
            title={describeRecurrence(task.recurrence)}
          >
            <IconRepeat width={11} height={11} />
            Repeats
          </span>
        )}
        {task.reminderAt && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink-soft"
            title={`Reminder: ${new Date(task.reminderAt).toLocaleString()}`}
          >
            <IconBell width={11} height={11} />
            Reminder
          </span>
        )}
      </div>

      <label className="mt-1 block text-xs">
        <span className="sr-only">Status for {task.title}</span>
        <select
          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
        >
          {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      <TaskFormModal
        isOpen={isEditOpen}
        onClose={() => setEditOpen(false)}
        task={task}
        projectId={projectId}
        projects={projects}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete task"
        message={`Delete "${task.title}"? This can't be undone.`}
        confirmLabel="Delete task"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteTask(task.id)
          setDeleteOpen(false)
        }}
      />
    </div>
  )
}
