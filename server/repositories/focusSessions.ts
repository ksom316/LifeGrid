import { randomUUID } from 'node:crypto'
import type { Sql, SqlPool } from '../db.ts'
import { withTransaction } from '../db.ts'
import { notFound } from '../http.ts'
import { assertOwnsProject, assertOwnsTask } from '../ownership.ts'
import { toDateTimeString, toDateTimeStringOrUndefined } from '../mapping.ts'
import { computeElapsedMs, msToMinutesRounded } from '../../src/utils/focusTimer.ts'
import type { FocusSession, FocusSessionStatus, FocusSessionType } from '../../src/types/domain.ts'

interface FocusSessionRow {
  id: string
  task_id: string | null
  project_id: string | null
  started_at: unknown
  ended_at: unknown
  duration_minutes: number
  note: string
  type: string | null
  status: string | null
  planned_duration_minutes: number | null
  accumulated_ms: string | number | null
  resumed_at: unknown
  is_demo: boolean
  created_at: unknown
  updated_at: unknown
}

function mapRow(row: FocusSessionRow): FocusSession {
  return {
    id: row.id,
    startedAt: toDateTimeString(row.started_at),
    endedAt: toDateTimeStringOrUndefined(row.ended_at),
    durationMinutes: row.duration_minutes,
    taskId: row.task_id ?? undefined,
    projectId: row.project_id ?? undefined,
    note: row.note,
    type: (row.type ?? undefined) as FocusSessionType | undefined,
    status: (row.status ?? undefined) as FocusSessionStatus | undefined,
    plannedDurationMinutes: row.planned_duration_minutes ?? undefined,
    accumulatedMs: row.accumulated_ms === null ? undefined : Number(row.accumulated_ms),
    resumedAt: toDateTimeStringOrUndefined(row.resumed_at),
    isDemo: row.is_demo || undefined,
    createdAt: toDateTimeString(row.created_at),
    updatedAt: toDateTimeString(row.updated_at),
  }
}

export async function listFocusSessions(sql: Sql, userId: string): Promise<FocusSession[]> {
  const { rows } = await sql.query<FocusSessionRow>(
    'select * from focus_sessions where user_id = $1 order by started_at desc',
    [userId],
  )
  return rows.map(mapRow)
}

export async function getFocusSession(sql: Sql, userId: string, id: string): Promise<FocusSession | undefined> {
  const { rows } = await sql.query<FocusSessionRow>('select * from focus_sessions where user_id = $1 and id = $2', [
    userId,
    id,
  ])
  return rows[0] ? mapRow(rows[0]) : undefined
}

async function insertSession(
  sql: Sql,
  userId: string,
  fields: {
    id?: string
    taskId?: string
    projectId?: string
    startedAt: string
    endedAt?: string
    durationMinutes: number
    note?: string
    type: FocusSessionType
    status: FocusSessionStatus
    plannedDurationMinutes?: number
    accumulatedMs?: number
    resumedAt?: string
    isDemo?: boolean
  },
): Promise<FocusSession> {
  if (fields.projectId) await assertOwnsProject(sql, userId, fields.projectId)
  if (fields.taskId) await assertOwnsTask(sql, userId, fields.taskId)
  const id = fields.id ?? randomUUID()
  const now = new Date().toISOString()
  await sql.query(
    `insert into focus_sessions (id, user_id, task_id, project_id, started_at, ended_at, duration_minutes, note, type, status, planned_duration_minutes, accumulated_ms, resumed_at, is_demo, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)`,
    [
      id,
      userId,
      fields.taskId ?? null,
      fields.projectId ?? null,
      fields.startedAt,
      fields.endedAt ?? null,
      fields.durationMinutes,
      fields.note ?? '',
      fields.type,
      fields.status,
      fields.plannedDurationMinutes ?? null,
      fields.accumulatedMs ?? null,
      fields.resumedAt ?? null,
      fields.isDemo ?? false,
      now,
    ],
  )
  return (await getFocusSession(sql, userId, id))!
}

export interface StartFocusSessionInput {
  type?: FocusSessionType
  plannedDurationMinutes: number
  projectId?: string
  taskId?: string
  isDemo?: boolean
}

export async function startFocusSession(sql: Sql, userId: string, input: StartFocusSessionInput): Promise<FocusSession> {
  const now = new Date().toISOString()
  return insertSession(sql, userId, {
    taskId: input.taskId,
    projectId: input.projectId,
    startedAt: now,
    durationMinutes: 0,
    type: input.type ?? 'focus',
    status: 'active',
    plannedDurationMinutes: input.plannedDurationMinutes,
    accumulatedMs: 0,
    resumedAt: now,
    isDemo: input.isDemo,
  })
}

export interface LogFocusSessionInput {
  id?: string
  startedAt?: string
  durationMinutes: number
  note?: string
  projectId?: string
  taskId?: string
  isDemo?: boolean
}

/** Equivalent of the client's manual/legacy focusSessionsRepo.create() — logging an already-finished session directly. */
export async function logFocusSession(sql: Sql, userId: string, input: LogFocusSessionInput): Promise<FocusSession> {
  const now = new Date().toISOString()
  return insertSession(sql, userId, {
    id: input.id,
    taskId: input.taskId,
    projectId: input.projectId,
    startedAt: input.startedAt ?? now,
    endedAt: now,
    durationMinutes: input.durationMinutes,
    note: input.note,
    type: 'focus',
    status: 'completed',
    plannedDurationMinutes: input.durationMinutes,
    isDemo: input.isDemo,
  })
}

export async function pauseFocusSession(sql: SqlPool, userId: string, id: string): Promise<FocusSession> {
  return withTransaction(sql, async (tx) => {
    const { rows } = await tx.query<FocusSessionRow>(
      'select * from focus_sessions where user_id = $1 and id = $2 for update',
      [userId, id],
    )
    const existingRow = rows[0]
    if (!existingRow) notFound('Focus session not found.')
    const existing = mapRow(existingRow)
    if (existing.status !== 'active') return existing

    const accumulatedMs = computeElapsedMs(existing)
    await tx.query(
      'update focus_sessions set status = $1, accumulated_ms = $2, resumed_at = null, updated_at = $3 where user_id = $4 and id = $5',
      ['paused', accumulatedMs, new Date().toISOString(), userId, id],
    )
    return (await getFocusSession(tx, userId, id))!
  })
}

export async function resumeFocusSession(sql: SqlPool, userId: string, id: string): Promise<FocusSession> {
  return withTransaction(sql, async (tx) => {
    const { rows } = await tx.query<FocusSessionRow>(
      'select * from focus_sessions where user_id = $1 and id = $2 for update',
      [userId, id],
    )
    const existingRow = rows[0]
    if (!existingRow) notFound('Focus session not found.')
    const existing = mapRow(existingRow)
    if (existing.status !== 'paused') return existing

    const now = new Date().toISOString()
    await tx.query('update focus_sessions set status = $1, resumed_at = $2, updated_at = $2 where user_id = $3 and id = $4', [
      'active',
      now,
      userId,
      id,
    ])
    return (await getFocusSession(tx, userId, id))!
  })
}

/**
 * Server-side equivalent of src/data/focusSessions.ts's finalizeSession():
 * same idempotency guarantee (a session can only transition out of
 * active/paused once), now enforced with `for update` row locking instead
 * of a single-threaded IndexedDB transaction, for the same reason as
 * completeTask() in repositories/tasks.ts.
 */
export async function finalizeFocusSession(
  sql: SqlPool,
  userId: string,
  id: string,
  outcome: 'completed' | 'interrupted',
): Promise<FocusSession> {
  return withTransaction(sql, async (tx) => {
    const { rows } = await tx.query<FocusSessionRow>(
      'select * from focus_sessions where user_id = $1 and id = $2 for update',
      [userId, id],
    )
    const existingRow = rows[0]
    if (!existingRow) notFound('Focus session not found.')
    const existing = mapRow(existingRow)
    if (existing.status !== 'active' && existing.status !== 'paused') return existing

    const elapsedMs = computeElapsedMs(existing)
    const now = new Date().toISOString()
    await tx.query(
      `update focus_sessions set status = $1, ended_at = $2, duration_minutes = $3, accumulated_ms = $4, resumed_at = null, updated_at = $2
       where user_id = $5 and id = $6`,
      [outcome, now, msToMinutesRounded(elapsedMs), elapsedMs, userId, id],
    )
    return (await getFocusSession(tx, userId, id))!
  })
}

export async function removeFocusSession(sql: Sql, userId: string, id: string): Promise<void> {
  const existing = await getFocusSession(sql, userId, id)
  if (!existing) notFound('Focus session not found.')
  await sql.query('delete from focus_sessions where user_id = $1 and id = $2', [userId, id])
}
