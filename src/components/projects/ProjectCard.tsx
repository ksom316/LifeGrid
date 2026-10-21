import { Link } from 'react-router-dom'
import { projectPriority } from '../../data/projects'
import type { Project, ProjectStatus, Task } from '../../types/domain'
import { formatShortDate, isOverdue } from '../../utils/date'
import { computeProjectTaskStats } from '../../utils/projectStats'
import { Badge } from '../ui/Badge'

const STATUS_TONE: Record<ProjectStatus, 'brand' | 'success' | 'neutral'> = {
  active: 'brand',
  paused: 'neutral',
  completed: 'success',
  archived: 'neutral',
}

const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const

const COLOR_DOT: Record<string, string> = {
  violet: 'bg-brand',
  teal: 'bg-teal-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500',
}

interface ProjectCardProps {
  project: Project
  tasks: Task[]
}

export function ProjectCard({ project, tasks }: ProjectCardProps) {
  const stats = computeProjectTaskStats(tasks)
  const deadlineOverdue =
    Boolean(project.targetDate) && project.status !== 'completed' && isOverdue(project.targetDate!)

  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_DOT[project.color]}`} />
          <h3 className="truncate text-base font-semibold text-ink">{project.name}</h3>
        </div>
        <Badge tone={PRIORITY_TONE[projectPriority(project)]}>{projectPriority(project)}</Badge>
      </div>

      {project.description && (
        <p className="line-clamp-2 text-sm text-ink-soft">{project.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
        {project.targetDate && (
          <Badge tone={deadlineOverdue ? 'danger' : 'neutral'}>
            {deadlineOverdue ? 'Overdue' : `Due ${formatShortDate(project.targetDate)}`}
          </Badge>
        )}
        {stats.overdue > 0 && (
          <Badge tone="danger">
            {stats.overdue} task{stats.overdue === 1 ? '' : 's'} overdue
          </Badge>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
          <span>{stats.total === 0 ? 'No tasks yet' : `${stats.completed}/${stats.total} tasks`}</span>
          {stats.total > 0 && <span>{stats.percent}%</span>}
        </div>
        <div className="h-1.5 w-full rounded-full bg-canvas">
          <div
            className="h-1.5 rounded-full bg-brand transition-all"
            style={{ width: `${stats.percent}%` }}
          />
        </div>
      </div>
    </Link>
  )
}
