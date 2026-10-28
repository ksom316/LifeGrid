import { Link } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import type { Task } from '../../types/domain'
import { todayKey } from '../../utils/date'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { ColorDot } from '../ui/ColorSwatch'
import { EmptyState } from '../ui/EmptyState'
import { IconCheck, IconFlag } from '../ui/icons'

const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const

/**
 * Mirrors the Focus tab's DailyPlanner: "today's priorities" is the same
 * date-keyed daily plan in both places, not a separately auto-computed
 * list. That's what makes a completed priority stay visible (checked off,
 * not removed from the plan) and what makes a new day start with a clean
 * slate — tomorrow's plan is a different record with its own empty
 * taskIds, so nothing carries over unless re-added.
 */
export function PrioritiesCard() {
  const { tasks, projects, dailyPlans, toggleTaskDone } = useAppData()
  const today = todayKey()
  const plan = dailyPlans.find((p) => p.id === today)
  const priorityTaskIds = plan?.taskIds ?? []

  const priorities = [...priorityTaskIds]
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t))
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))

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
          title="No priorities picked for today"
          description="Plan your day on the Focus tab to see them here."
          action={
            <Link to="/focus" className="text-xs font-medium text-brand-ink hover:underline">
              Plan today
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {priorities.map((task) => (
            <PriorityRow
              key={task.id}
              task={task}
              projectId={task.projectId}
              projectName={projects.find((p) => p.id === task.projectId)?.name}
              projectColor={projects.find((p) => p.id === task.projectId)?.color}
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
  projectColor,
  onToggle,
}: {
  task: Task
  projectId?: string
  projectName?: string
  projectColor?: unknown
  onToggle: () => void
}) {
  const done = task.status === 'done'
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-canvas px-2.5 py-2.5 transition-colors hover:border-border-strong">
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        aria-pressed={done}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          done
            ? 'border-brand bg-brand text-white'
            : 'border-border-strong text-transparent hover:border-brand hover:bg-brand-soft hover:text-brand'
        }`}
      >
        <IconCheck width={12} height={12} />
      </button>
      {projectId ? (
        <Link
          to={`/projects/${projectId}?task=${task.id}`}
          className={`flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs font-medium hover:text-brand-ink ${
            done ? 'text-ink-soft line-through' : 'text-ink'
          }`}
          title={projectName}
        >
          <ColorDot color={projectColor} />
          <span className="truncate">{task.title}</span>
        </Link>
      ) : (
        <span
          className={`min-w-0 flex-1 truncate text-xs font-medium ${done ? 'text-ink-soft line-through' : 'text-ink'}`}
        >
          {task.title}
        </span>
      )}
      <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
    </li>
  )
}
