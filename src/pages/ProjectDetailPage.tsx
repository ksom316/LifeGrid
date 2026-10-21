import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { projectPriority } from '../data/projects'
import { useAppData } from '../state/AppDataContext'
import type { ProjectStatus } from '../types/domain'
import { NoteFormModal } from '../components/notes/NoteFormModal'
import { ProjectFormModal } from '../components/projects/ProjectFormModal'
import { TaskBoard } from '../components/projects/TaskBoard'
import { TaskFormModal } from '../components/projects/TaskFormModal'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import {
  IconArrowLeft,
  IconFolder,
  IconPencil,
  IconPlus,
  IconTrash,
} from '../components/ui/icons'
import { formatLongDate, formatShortDate } from '../utils/date'
import { sessionStatus, sessionType } from '../utils/focusTimer'
import { computeProjectTaskStats } from '../utils/projectStats'

const STATUS_TONE: Record<ProjectStatus, 'brand' | 'success' | 'neutral'> = {
  active: 'brand',
  paused: 'neutral',
  completed: 'success',
  archived: 'neutral',
}

const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const highlightTaskId = searchParams.get('task') ?? undefined
  const navigate = useNavigate()
  const { status, error, projects, tasks, notes, focusSessions, deleteProject, refresh } = useAppData()
  const [isEditOpen, setEditOpen] = useState(false)
  const [isAddTaskOpen, setAddTaskOpen] = useState(false)
  const [isAddNoteOpen, setAddNoteOpen] = useState(false)
  const [isDeleteOpen, setDeleteOpen] = useState(false)

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-soft">
        Loading project…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-danger-soft bg-danger-soft px-6 py-10 text-center">
        <p className="text-sm font-medium text-danger">Life Grid couldn't load this project.</p>
        {error && <p className="max-w-md text-xs text-ink-soft">{error}</p>}
        <Button variant="secondary" onClick={refresh}>
          Try again
        </Button>
      </div>
    )
  }

  const project = projects.find((p) => p.id === id)

  if (!project) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
        <IconFolder width={32} height={32} className="text-muted" />
        <p className="text-sm font-medium text-ink">Project not found</p>
        <p className="max-w-sm text-sm text-ink-soft">
          This project may have been deleted, or the link is no longer valid.
        </p>
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    )
  }

  const projectTasks = tasks.filter((t) => t.projectId === project.id)
  const projectNotes = notes
    .filter((n) => n.projectId === project.id)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  const taskStats = computeProjectTaskStats(projectTasks)
  const projectFocusSessions = focusSessions
    .filter(
      (s) => s.projectId === project.id && sessionType(s) === 'focus' && sessionStatus(s) === 'completed',
    )
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
  const totalFocusMinutes = projectFocusSessions.reduce((sum, s) => sum + s.durationMinutes, 0)

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/projects"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
      >
        <IconArrowLeft width={16} height={16} />
        Back to Projects
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{project.name}</h1>
            <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
            <Badge tone={PRIORITY_TONE[projectPriority(project)]}>{projectPriority(project)}</Badge>
          </div>
          {project.description && (
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{project.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            {project.startDate && <span>Started {formatLongDate(project.startDate)}</span>}
            {project.targetDate && <span>Deadline {formatLongDate(project.targetDate)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            icon={<IconPencil width={16} height={16} />}
            onClick={() => setEditOpen(true)}
          >
            Edit project
          </Button>
          <Button
            variant="danger"
            icon={<IconTrash width={16} height={16} />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <Card title="Task progress">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total" value={taskStats.total} />
          <Stat label="Completed" value={taskStats.completed} />
          <Stat label="Remaining" value={taskStats.remaining} />
          <Stat label="Overdue" value={taskStats.overdue} tone={taskStats.overdue > 0 ? 'danger' : undefined} />
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-canvas">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-brand to-violet-500 transition-all"
            style={{ width: `${taskStats.percent}%` }}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Tasks</h2>
        <Button
          variant="primary"
          size="sm"
          icon={<IconPlus width={16} height={16} />}
          onClick={() => setAddTaskOpen(true)}
        >
          Add task
        </Button>
      </div>

      {projectTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">No tasks in this project yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
            Add your first task to start tracking progress on {project.name}.
          </p>
          <Button className="mt-4" variant="primary" onClick={() => setAddTaskOpen(true)}>
            Add task
          </Button>
        </div>
      ) : (
        <TaskBoard
          projectId={project.id}
          tasks={projectTasks}
          projects={projects}
          highlightTaskId={highlightTaskId}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Notes</h2>
        <Button
          variant="secondary"
          size="sm"
          icon={<IconPlus width={16} height={16} />}
          onClick={() => setAddNoteOpen(true)}
        >
          Add note
        </Button>
      </div>

      {projectNotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">No notes linked to this project yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
            Link a note to {project.name} to keep context alongside its tasks.
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => setAddNoteOpen(true)}>
            Add note
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {projectNotes.map((note) => (
            <li key={note.id}>
              <Link
                to={`/vault/${note.id}`}
                className="block rounded-lg border border-border bg-surface p-3 transition-colors hover:border-brand"
              >
                <p className="truncate text-sm font-medium text-ink">{note.title}</p>
                {note.content && (
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-ink-soft">
                    {note.content}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-soft">Updated {formatShortDate(note.updatedAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {projectFocusSessions.length > 0 && (
        <Card title="Focus time">
          <p className="mb-3 text-sm text-ink-soft">
            <span className="font-medium text-ink">{totalFocusMinutes} minutes</span> focused on this
            project across {projectFocusSessions.length} session
            {projectFocusSessions.length === 1 ? '' : 's'}.
          </p>
          <ul className="flex flex-col gap-1.5">
            {projectFocusSessions.slice(0, 5).map((session) => (
              <li key={session.id} className="flex items-center justify-between text-xs text-ink-soft">
                <span>{new Date(session.startedAt).toLocaleDateString()}</span>
                <span>{session.durationMinutes} min</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ProjectFormModal isOpen={isEditOpen} onClose={() => setEditOpen(false)} project={project} />
      <TaskFormModal
        isOpen={isAddTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        projectId={project.id}
      />
      <NoteFormModal
        isOpen={isAddNoteOpen}
        onClose={() => setAddNoteOpen(false)}
        projectId={project.id}
      />
      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete project"
        message={(() => {
          const parts: string[] = []
          if (taskStats.total > 0) {
            parts.push(`${taskStats.total} task${taskStats.total === 1 ? '' : 's'}`)
          }
          if (projectNotes.length > 0) {
            parts.push(`${projectNotes.length} note${projectNotes.length === 1 ? '' : 's'}`)
          }
          return parts.length > 0
            ? `Delete "${project.name}"? Its ${parts.join(' and ')} will be kept and become unassigned — they won't be deleted.`
            : `Delete "${project.name}"? This can't be undone.`
        })()}
        confirmLabel="Delete project"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteProject(project.id)
          navigate('/projects')
        }}
      />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div>
      <p
        className={`text-3xl font-bold tracking-tight tabular-nums ${tone === 'danger' && value > 0 ? 'text-danger' : 'text-ink'}`}
      >
        {value}
      </p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  )
}
