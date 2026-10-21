import { randomUUID } from 'node:crypto'
import type { Sql, SqlPool } from '../db.ts'
import { withTransaction } from '../db.ts'
import { notFound } from '../http.ts'
import { assertOwnsProject } from '../ownership.ts'
import { toDateStringOrUndefined, toDateTimeString, toDateTimeStringOrUndefined } from '../mapping.ts'
import { computeNextDueDate } from '../../src/utils/recurrence.ts'
import type { Task, TaskPriority, TaskRecurrence, TaskStatus } from '../../src/types/domain.ts'

interface TaskRow {
  id: string
  project_id: string | null
  title: string
  notes: string
  status: string
  priority: string
  due_date: unknown
  completed_at: unknown
  recurrence: TaskRecurrence | null
  recurrence_parent_id: string | null
  reminder_at: unknown
  is_demo: boolean
  created_at: unknown
  updated_at: unknown
}

function mapRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    projectId: row.project_id ?? undefined,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    dueDate: toDateStringOrUndefined(row.due_date),
    completedAt: toDateTimeStringOrUndefined(row.completed_at),
    recurrence: row.recurrence ?? undefined,
    recurrenceParentId: row.recurrence_parent_id ?? undefined,
    reminderAt: toDateTimeStringOrUndefined(row.reminder_at),
    isDemo: row.is_demo || undefined,
    createdAt: toDateTimeString(row.created_at),
    updatedAt: toDateTimeString(row.updated_at),
  }
}

export async function listTasks(sql: Sql, userId: string): Promise<Task[]> {
  const { rows } = await sql.query<TaskRow>('select * from tasks where user_id = $1 order by updated_at desc', [
    userId,
  ])
  return rows.map(mapRow)
}

export async function getTask(sql: Sql, userId: string, id: string): Promise<Task | undefined> {
  const { rows } = await sql.query<TaskRow>('select * from tasks where user_id = $1 and id = $2', [userId, id])
  return rows[0] ? mapRow(rows[0]) : undefined
}

export interface CreateTaskInput {
  id?: string
  title: string
  notes?: string
  projectId?: string
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string
  completedAt?: string
  recurrence?: TaskRecurrence
  recurrenceParentId?: string
  reminderAt?: string
  isDemo?: boolean
  createdAt?: string
  updatedAt?: string
}

export async function createTask(sql: Sql, userId: string, input: CreateTaskInput): Promise<Task> {
  if (input.projectId) await assertOwnsProject(sql, userId, input.projectId)
  const id = input.id ?? randomUUID()
  const now = new Date().toISOString()
  await sql.query(
    `insert into tasks (id, user_id, project_id, title, notes, status, priority, due_date, completed_at, recurrence, recurrence_parent_id, reminder_at, is_demo, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      userId,
      input.projectId ?? null,
      input.title,
      input.notes ?? '',
      input.status ?? 'todo',
      input.priority ?? 'medium',
      input.dueDate ?? null,
      input.completedAt ?? null,
      input.recurrence ? JSON.stringify(input.recurrence) : null,
      input.recurrenceParentId ?? null,
      input.reminderAt ?? null,
      input.isDemo ?? false,
      input.createdAt ?? now,
      input.updatedAt ?? now,
    ],
  )
  return (await getTask(sql, userId, id))!
}

export interface UpdateTaskInput {
  title?: string
  notes?: string
  projectId?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string | null
  completedAt?: string | null
  recurrence?: TaskRecurrence | null
  reminderAt?: string | null
}

export async function updateTask(sql: Sql, userId: string, id: string, patch: UpdateTaskInput): Promise<Task> {
  const existing = await getTask(sql, userId, id)
  if (!existing) notFound('Task not found.')
  if (patch.projectId) await assertOwnsProject(sql, userId, patch.projectId)

  const next = {
    title: patch.title ?? existing.title,
    notes: patch.notes ?? existing.notes,
    project_id: patch.projectId === undefined ? (existing.projectId ?? null) : patch.projectId,
    status: patch.status ?? existing.status,
    priority: patch.priority ?? existing.priority,
    due_date: patch.dueDate === undefined ? (existing.dueDate ?? null) : patch.dueDate,
    completed_at: patch.completedAt === undefined ? (existing.completedAt ?? null) : patch.completedAt,
    recurrence:
      patch.recurrence === undefined ? (existing.recurrence ?? null) : (patch.recurrence ? JSON.stringify(patch.recurrence) : null),
    reminder_at: patch.reminderAt === undefined ? (existing.reminderAt ?? null) : patch.reminderAt,
  }
  await sql.query(
    `update tasks set title=$1, notes=$2, project_id=$3, status=$4, priority=$5, due_date=$6, completed_at=$7, recurrence=$8, reminder_at=$9, updated_at=$10
     where user_id = $11 and id = $12`,
    [
      next.title,
      next.notes,
      next.project_id,
      next.status,
      next.priority,
      next.due_date,
      next.completed_at,
      next.recurrence,
      next.reminder_at,
      new Date().toISOString(),
      userId,
      id,
    ],
  )
  return (await getTask(sql, userId, id))!
}

export async function removeTask(sql: Sql, userId: string, id: string): Promise<void> {
  const existing = await getTask(sql, userId, id)
  if (!existing) notFound('Task not found.')
  await sql.query('delete from tasks where user_id = $1 and id = $2', [userId, id])
}

export interface CompleteTaskResult {
  completed: Task
  nextOccurrence?: Task
}

/**
 * Server-side equivalent of src/data/tasks.ts's completeTask(): the same
 * "preserve history, generate at most one next occurrence" guarantee, now
 * enforced by a Postgres row lock instead of a single-threaded IndexedDB
 * transaction. `select ... for update` blocks any concurrent request for
 * the same task row until this transaction commits, so two near-simultaneous
 * completion requests for the same task serialize instead of racing — the
 * second one sees the row already marked done (or the next occurrence
 * already present) and becomes a no-op, exactly like the client's repeated/
 * concurrent-call idempotency tests.
 */
export async function completeTask(sql: SqlPool, userId: string, id: string): Promise<CompleteTaskResult> {
  return withTransaction(sql, async (tx) => {
    const { rows } = await tx.query<TaskRow>('select * from tasks where user_id = $1 and id = $2 for update', [
      userId,
      id,
    ])
    const existingRow = rows[0]
    if (!existingRow) notFound('Task not found.')
    const existing = mapRow(existingRow)

    if (existing.status === 'done') {
      return { completed: existing }
    }

    const now = new Date().toISOString()
    await tx.query('update tasks set status = $1, completed_at = $2, updated_at = $3 where user_id = $4 and id = $5', [
      'done',
      now,
      now,
      userId,
      id,
    ])
    const completed = (await getTask(tx, userId, id))!

    let nextOccurrence: Task | undefined
    if (existing.recurrence && existing.dueDate) {
      const { rows: existingNext } = await tx.query<{ id: string }>(
        'select id from tasks where user_id = $1 and recurrence_parent_id = $2',
        [userId, id],
      )
      if (existingNext.length === 0) {
        const nextDueDate = computeNextDueDate(existing.dueDate, existing.recurrence)
        if (nextDueDate) {
          const nextId = randomUUID()
          await tx.query(
            `insert into tasks (id, user_id, project_id, title, notes, status, priority, due_date, recurrence, recurrence_parent_id, is_demo, created_at, updated_at)
             values ($1,$2,$3,$4,$5,'todo',$6,$7,$8,$9,$10,$11,$11)`,
            [
              nextId,
              userId,
              existing.projectId ?? null,
              existing.title,
              existing.notes,
              existing.priority,
              nextDueDate,
              JSON.stringify(existing.recurrence),
              id,
              existing.isDemo ?? false,
              now,
            ],
          )
          nextOccurrence = (await getTask(tx, userId, nextId))!
        }
      }
    }

    return { completed, nextOccurrence }
  })
}

export async function reopenTask(sql: Sql, userId: string, id: string): Promise<Task> {
  return updateTask(sql, userId, id, { status: 'todo', completedAt: null })
}
