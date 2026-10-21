import { Link } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import type { Task } from '../../types/domain'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { IconCheck, IconFlag } from '../ui/icons'
import { isOverdue, isToday } from '../../utils/date'

const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const

export function PrioritiesCard() {
  const { tasks, projects, toggleTaskDone } = useAppData()

  const priorities = tasks
    .filter((t) => t.status !== 'done')
    .filter((t) => t.priority === 'high' || (t.dueDate && (isToday(t.dueDate) || isOverdue(t.dueDate))))
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.priority] - order[b.priority]
    })
    .slice(0, 6)

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <IconFlag width={14} height={14} className="text-brand-ink" />
          Today's priorities
        </span>
      }
    >
      {priorities.length === 0 ? (
        <EmptyState
          icon={<IconFlag width={28} height={28} />}
          title="Nothing urgent today"
          description="High-priority tasks and anything due today will show up here."
        />
      ) : (
        <ul className="-mx-2 flex flex-col divide-y divide-border">
          {priorities.map((task) => (
            <PriorityRow
              key={task.id}
              task={task}
              projectId={task.projectId}
              projectName={projects.find((p) => p.id === task.projectId)?.name}
              onToggle={() => toggleTaskDone(task.id)}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function PriorityRow({
  task,
  projectId,
  projectName,
  onToggle,
}: {
  task: Task
  projectId?: string
  projectName?: string
  onToggle: () => void
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-hover">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Mark "${task.title}" as done`}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-strong text-transparent transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
      >
        <IconCheck width={12} height={12} />
      </button>
      {projectId ? (
        <Link
          to={`/projects/${projectId}?task=${task.id}`}
          className="min-w-0 flex-1 truncate text-sm text-ink hover:text-brand-ink"
          title={projectName}
        >
          {task.title}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{task.title}</span>
      )}
      <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
    </li>
  )
}
