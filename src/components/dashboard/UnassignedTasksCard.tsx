import { useState } from 'react'
import { useAppData } from '../../state/AppDataContext'
import { TaskFormModal } from '../projects/TaskFormModal'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { IconCheck, IconClipboard } from '../ui/icons'

const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const

/**
 * Tasks with no project have nowhere else to appear: they're not on any
 * project board. Without this card, a task added from the Dashboard's quick
 * action (which has no project to attach to) is created successfully but
 * then invisible anywhere in the app unless it happens to be high-priority
 * or have a due date — in which case PrioritiesCard/DeadlinesCard already
 * show it, so those are excluded here to avoid listing the same task twice.
 */
export function UnassignedTasksCard() {
  const { tasks, toggleTaskDone } = useAppData()
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const unassigned = tasks
    .filter((t) => !t.projectId && t.status !== 'done' && t.priority !== 'high' && !t.dueDate)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 6)

  const editingTask = tasks.find((t) => t.id === editingTaskId)

  return (
    <Card title="Other tasks">
      {unassigned.length === 0 ? (
        <EmptyState
          icon={<IconClipboard width={28} height={28} />}
          title="No standalone tasks"
          description="Tasks you add without a project will show up here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {unassigned.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <button
                type="button"
                onClick={() => toggleTaskDone(task.id)}
                aria-label={`Mark "${task.title}" as done`}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-transparent hover:border-brand hover:text-brand"
              >
                <IconCheck width={12} height={12} />
              </button>
              <button
                type="button"
                onClick={() => setEditingTaskId(task.id)}
                className="min-w-0 flex-1 truncate text-left text-sm text-ink hover:text-brand-ink"
              >
                {task.title}
              </button>
              <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
            </li>
          ))}
        </ul>
      )}

      <TaskFormModal
        isOpen={editingTask !== undefined}
        onClose={() => setEditingTaskId(null)}
        task={editingTask}
      />
    </Card>
  )
}
