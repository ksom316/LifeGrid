import { isOverdue } from './date'
import type { Task } from '../types/domain'

export interface ProjectTaskStats {
  total: number
  completed: number
  remaining: number
  overdue: number
  percent: number
}

/** Derives task progress for a project from its actual tasks — never a stored, manually editable number. */
export function computeProjectTaskStats(tasks: Task[]): ProjectTaskStats {
  const total = tasks.length
  const completed = tasks.filter((t) => t.status === 'done').length
  const overdue = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && isOverdue(t.dueDate),
  ).length
  const remaining = total - completed
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { total, completed, remaining, overdue, percent }
}
