import { Link } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { ColorDot } from '../ui/ColorSwatch'
import { EmptyState } from '../ui/EmptyState'
import { IconTimer } from '../ui/icons'
import { formatShortDate, isOverdue } from '../../utils/date'

export function DeadlinesCard() {
  const { tasks, projects } = useAppData()

  const upcoming = tasks
    .filter((t) => t.status !== 'done' && t.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 6)

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <IconTimer width={14} height={14} className="text-brand-ink" />
          Upcoming deadlines
        </span>
      }
    >
      {upcoming.length === 0 ? (
        <EmptyState
          icon={<IconTimer width={28} height={28} />}
          title="No deadlines scheduled"
          description="Tasks with a due date will appear here, soonest first."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((task) => {
            const project = projects.find((p) => p.id === task.projectId)
            const overdue = isOverdue(task.dueDate!)
            return (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-canvas px-2.5 py-2.5 transition-colors hover:border-border-strong"
              >
                {project ? (
                  <Link
                    to={`/projects/${project.id}?task=${task.id}`}
                    className="min-w-0 flex-1 truncate text-xs font-medium text-ink hover:text-brand-ink"
                  >
                    {task.title}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{task.title}</span>
                )}
                {project && (
                  <span className="hidden items-center gap-1.5 truncate text-xs text-ink-soft sm:flex">
                    <ColorDot color={project.color} />
                    {project.name}
                  </span>
                )}
                <Badge tone={overdue ? 'danger' : 'neutral'}>
                  {overdue ? 'Overdue' : formatShortDate(task.dueDate!)}
                </Badge>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
