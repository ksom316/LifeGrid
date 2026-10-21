import { useAppData } from '../../state/AppDataContext'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { IconFolder } from '../ui/icons'

const COLOR_DOT: Record<string, string> = {
  violet: 'bg-brand',
  teal: 'bg-teal-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500',
}

export function ProjectsOverviewCard() {
  const { projects, tasks } = useAppData()
  const active = projects.filter((p) => p.status === 'active').slice(0, 5)

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <IconFolder width={14} height={14} className="text-brand-ink" />
          Active projects
        </span>
      }
    >
      {active.length === 0 ? (
        <EmptyState
          icon={<IconFolder width={28} height={28} />}
          title="No active projects yet"
          description="Create a project to start grouping tasks, notes, and focus time."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {active.map((project) => {
            const projectTasks = tasks.filter((t) => t.projectId === project.id)
            const done = projectTasks.filter((t) => t.status === 'done').length
            const total = projectTasks.length
            const pct = total === 0 ? 0 : Math.round((done / total) * 100)
            return (
              <li key={project.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT[project.color]}`} />
                  <span className="flex-1 truncate text-sm font-medium text-ink">
                    {project.name}
                  </span>
                  <span className="text-xs tabular-nums text-ink-soft">
                    {total === 0 ? 'No tasks' : `${done}/${total}`}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-canvas">
                  <div
                    className="h-1.5 rounded-full bg-brand transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
