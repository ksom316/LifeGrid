import type { Project, Task, TaskStatus } from '../../types/domain'
import { TaskCard } from './TaskCard'

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'in-progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
]

interface TaskBoardProps {
  projectId: string
  tasks: Task[]
  projects: Project[]
  highlightTaskId?: string
}

export function TaskBoard({ projectId, tasks, projects, highlightTaskId }: TaskBoardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.status)
        return (
          <div
            key={column.status}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
          >
            <div className="flex items-center justify-between px-1 pt-1">
              <h3 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                {column.label}
              </h3>
              <span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-xs tabular-nums text-ink-soft">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {columnTasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-ink-soft">
                  No tasks here
                </p>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    projectId={projectId}
                    projects={projects}
                    highlighted={task.id === highlightTaskId}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
