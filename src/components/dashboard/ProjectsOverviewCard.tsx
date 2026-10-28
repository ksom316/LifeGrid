import { Link } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { IconFolder } from '../ui/icons'
import { ColorDot } from '../ui/ColorSwatch'
import { colorHex, resolveColor } from '../../utils/colors'

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
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {active.map((project) => {
            const projectTasks = tasks.filter((t) => t.projectId === project.id)
            const done = projectTasks.filter((t) => t.status === 'done').length
            const total = projectTasks.length
            const pct = total === 0 ? 0 : Math.round((done / total) * 100)
            return (
              <li key={project.id}>
                <Link
                  to={`/projects/${project.id}`}
                  className="block h-full rounded-lg border border-border bg-canvas p-4 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <ColorDot color={project.color} />
                    <span className="flex-1 truncate text-xs font-semibold text-ink">{project.name}</span>
                  </div>
                  {project.description && (
                    <p className="mb-3 line-clamp-2 text-[11px] text-ink-soft">{project.description}</p>
                  )}
                  <div className="mb-1.5 flex justify-between text-[10px]">
                    <span className="text-ink-soft">{total === 0 ? 'No tasks' : `${done}/${total} tasks`}</span>
                    {total > 0 && <span className="font-medium text-ink">{pct}%</span>}
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-chrome">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: colorHex(resolveColor(project.color)) }}
                    />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
