import { getDb } from './db'
import { createId, createRepository, nowISO } from './repository'
import { computeNextDueDate } from '../utils/recurrence'
import type { Task, TaskPriority, TaskRecurrence, TaskStatus } from '../types/domain'

const repo = createRepository<Task>('tasks')

export interface CreateTaskInput {
  title: string
  notes?: string
  projectId?: string
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string
  recurrence?: TaskRecurrence
  reminderAt?: string
  isDemo?: boolean
}

export interface CompleteTaskResult {
  completed: Task
  /** Present only when a new occurrence was actually generated. */
  nextOccurrence?: Task
}

export const tasksRepo = {
  list: repo.list,
  get: repo.get,
  remove: repo.remove,
  removeMany: repo.removeMany,

  async update(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task> {
    const existing = await repo.get(id)
    if (!existing) throw new Error(`Task ${id} not found`)
    const updated: Task = { ...existing, ...patch, updatedAt: nowISO() }
    return repo.put(updated)
  },

  async create(input: CreateTaskInput): Promise<Task> {
    const timestamp = nowISO()
    const task: Task = {
      id: createId(),
      title: input.title.trim(),
      notes: input.notes?.trim() ?? '',
      projectId: input.projectId,
      status: input.status ?? 'todo',
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate,
      recurrence: input.recurrence,
      reminderAt: input.reminderAt,
      createdAt: timestamp,
      updatedAt: timestamp,
      isDemo: input.isDemo,
    }
    return repo.put(task)
  },

  /**
   * Marks a task complete and, if it's an active recurring task with a due
   * date, generates its next occurrence as a brand-new task record — all
   * within a single IndexedDB transaction. Idempotent: calling this again
   * on an already-completed task (e.g. a double-click, or two in-flight
   * calls racing) is a no-op and returns the existing record without ever
   * generating a second next-occurrence, because the terminal-status check
   * and the write happen inside the same transaction rather than two
   * separate read-then-write round trips (the latter pattern previously
   * caused an equivalent duplicate-completion race for focus sessions).
   */
  async completeTask(id: string): Promise<CompleteTaskResult> {
    const db = await getDb()
    const tx = db.transaction('tasks', 'readwrite')
    const store = tx.store
    try {
      const existing = await store.get(id)
      if (!existing) throw new Error(`Task ${id} not found`)
      if (existing.status === 'done') {
        await tx.done
        return { completed: existing }
      }

      const timestamp = nowISO()
      const completed: Task = { ...existing, status: 'done', completedAt: timestamp, updatedAt: timestamp }
      await store.put(completed)

      let nextOccurrence: Task | undefined
      if (existing.recurrence && existing.dueDate) {
        // Defense in depth alongside the transaction itself: never generate
        // a second next-occurrence for the same completed task.
        const all = await store.getAll()
        const alreadyGenerated = all.some((t) => t.recurrenceParentId === id)
        if (!alreadyGenerated) {
          const nextDueDate = computeNextDueDate(existing.dueDate, existing.recurrence)
          if (nextDueDate) {
            nextOccurrence = {
              id: createId(),
              title: existing.title,
              notes: existing.notes,
              projectId: existing.projectId,
              status: 'todo',
              priority: existing.priority,
              dueDate: nextDueDate,
              recurrence: existing.recurrence,
              recurrenceParentId: id,
              createdAt: timestamp,
              updatedAt: timestamp,
              isDemo: existing.isDemo,
            }
            await store.put(nextOccurrence)
          }
        }
      }

      await tx.done
      return { completed, nextOccurrence }
    } catch (err) {
      try {
        tx.abort()
      } catch {
        // Transaction may already be closed; nothing more to do.
      }
      await tx.done.catch(() => {})
      throw err
    }
  },

  async toggleDone(id: string): Promise<Task> {
    const existing = await repo.get(id)
    if (!existing) throw new Error(`Task ${id} not found`)
    if (existing.status === 'done') {
      // Reopening never touches any next occurrence that may already have
      // been generated — that occurrence is its own independent task.
      return this.update(id, { status: 'todo', completedAt: undefined })
    }
    const { completed } = await this.completeTask(id)
    return completed
  },
}
