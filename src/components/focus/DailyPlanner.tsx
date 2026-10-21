import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import type { Project, Task } from '../../types/domain'
import { isOverdue, isToday, todayKey } from '../../utils/date'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Field, inputClasses } from '../ui/Field'
import { IconCheck, IconClipboard, IconPlus, IconX } from '../ui/icons'

const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const

export function DailyPlanner() {
  const { tasks, projects, dailyPlans, addDailyPriority, removeDailyPriority, toggleTaskDone } =
    useAppData()
  const [pickerTaskId, setPickerTaskId] = useState('')
  const today = todayKey()
  const plan = dailyPlans.find((p) => p.id === today)
  const priorityTaskIds = plan?.taskIds ?? []

  const priorityTasks = priorityTaskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  const pickableTasks = tasks.filter(
    (t) => t.status !== 'done' && !priorityTaskIds.includes(t.id),
  )

  // Mutually exclusive buckets — each open task with a due date lands in
  // exactly one of these, so nothing is ever shown twice.
  const notInPriorities = (t: Task) => !priorityTaskIds.includes(t.id)
  const overdueTasks = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && isOverdue(t.dueDate) && notInPriorities(t),
  )
  const dueTodayTasks = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && isToday(t.dueDate) && notInPriorities(t),
  )
  const upcomingTasks = tasks.filter(
    (t) =>
      t.status !== 'done' &&
      t.dueDate &&
      !isOverdue(t.dueDate) &&
      !isToday(t.dueDate) &&
      notInPriorities(t),
  )

  const handleAdd = async () => {
    if (!pickerTaskId) return
    await addDailyPriority(today, pickerTaskId)
    setPickerTaskId('')
  }

  return (
    <Card title="Today's priorities">
      {priorityTasks.length === 0 ? (
        <EmptyState
          icon={<IconClipboard width={28} height={28} />}
          title="No priorities picked for today"
          description="Pick a few tasks below to focus on today."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {[...priorityTasks]
            .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
            .map((task) => {
            const project = projects.find((p) => p.id === task.projectId)
            const done = task.status === 'done'
            return (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => toggleTaskDone(task.id)}
                  aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                  aria-pressed={done}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    done
                      ? 'border-brand bg-brand text-white'
                      : 'border-border text-transparent hover:border-brand hover:text-brand'
                  }`}
                >
                  <IconCheck width={12} height={12} />
                </button>
                {project ? (
                  <Link
                    to={`/projects/${project.id}?task=${task.id}`}
                    className={`flex-1 truncate text-sm hover:text-brand-ink ${
                      done ? 'text-ink-soft line-through' : 'text-ink'
                    }`}
                  >
                    {task.title}
                  </Link>
                ) : (
                  <span className={`flex-1 truncate text-sm ${done ? 'text-ink-soft line-through' : 'text-ink'}`}>
                    {task.title}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeDailyPriority(today, task.id)}
                  aria-label={`Remove "${task.title}" from today's priorities`}
                  className="rounded-md p-1 text-ink-soft hover:bg-surface-hover hover:text-ink"
                >
                  <IconX width={14} height={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {pickableTasks.length > 0 && (
        <div className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <Field label="Add a priority">
              <select
                className={inputClasses}
                value={pickerTaskId}
                onChange={(e) => setPickerTaskId(e.target.value)}
              >
                <option value="">Choose a task…</option>
                {pickableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button variant="secondary" onClick={handleAdd} disabled={!pickerTaskId}>
            Add
          </Button>
        </div>
      )}

      {(overdueTasks.length > 0 || dueTodayTasks.length > 0 || upcomingTasks.length > 0) && (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <TaskGroup
            label="Overdue"
            tone="danger"
            tasks={overdueTasks}
            projects={projects}
            onAddPriority={(id) => addDailyPriority(today, id)}
          />
          <TaskGroup
            label="Due today"
            tone="warning"
            tasks={dueTodayTasks}
            projects={projects}
            onAddPriority={(id) => addDailyPriority(today, id)}
          />
          <TaskGroup
            label="Upcoming"
            tone="neutral"
            tasks={upcomingTasks}
            projects={projects}
            onAddPriority={(id) => addDailyPriority(today, id)}
          />
        </div>
      )}
    </Card>
  )
}

function TaskGroup({
  label,
  tone,
  tasks,
  projects,
  onAddPriority,
}: {
  label: string
  tone: 'danger' | 'warning' | 'neutral'
  tasks: Task[]
  projects: Project[]
  onAddPriority: (taskId: string) => void
}) {
  if (tasks.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-soft">{label}</p>
      <ul className="flex flex-col gap-1">
        {tasks.map((task) => {
          const project = projects.find((p) => p.id === task.projectId)
          return (
            <li
              key={task.id}
              className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
            >
              {project ? (
                <Link
                  to={`/projects/${project.id}?task=${task.id}`}
                  className="min-w-0 flex-1 truncate text-sm text-ink hover:text-brand-ink"
                >
                  {task.title}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{task.title}</span>
              )}
              <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
              <Badge tone={tone}>{label}</Badge>
              <button
                type="button"
                onClick={() => onAddPriority(task.id)}
                aria-label={`Add "${task.title}" to today's priorities`}
                className="rounded-md p-1 text-ink-soft hover:bg-surface-hover hover:text-ink"
              >
                <IconPlus width={14} height={14} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
