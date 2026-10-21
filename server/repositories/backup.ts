import type { Sql, SqlPool } from '../db.ts'
import { withTransaction } from '../db.ts'
import { badRequest } from '../http.ts'
import { countsOf, decideMergeAction } from '../../src/data/backupValidation.ts'
import { BACKUP_FORMAT, BACKUP_STORE_KEYS, BACKUP_VERSION } from '../../src/types/backup.ts'
import { DB_VERSION } from '../../src/types/dbVersion.ts'
import type { BackupData, LifeGridBackup, RestoreCounts, RestoreResult, RestoreStrategy } from '../../src/types/backup.ts'
import type { BaseRecord } from '../../src/types/domain.ts'
import { listProjects } from './projects.ts'
import { listTasks } from './tasks.ts'
import { listNotes } from './notes.ts'
import { listFocusSessions } from './focusSessions.ts'
import { listDailyPlans } from './dailyPlans.ts'
import { listWeeklyReviews } from './weeklyReviews.ts'

export async function exportBackup(sql: Sql, userId: string, includeDemoData: boolean): Promise<LifeGridBackup> {
  const [projects, tasks, notes, focusSessions, dailyPlans, weeklyReviews] = await Promise.all([
    listProjects(sql, userId),
    listTasks(sql, userId),
    listNotes(sql, userId),
    listFocusSessions(sql, userId),
    listDailyPlans(sql, userId),
    listWeeklyReviews(sql, userId),
  ])

  const data: BackupData = { projects, tasks, notes, focusSessions, dailyPlans, weeklyReviews }
  if (!includeDemoData) {
    for (const key of BACKUP_STORE_KEYS) {
      ;(data[key] as BaseRecord[]) = (data[key] as BaseRecord[]).filter((r) => !r.isDemo)
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    dbVersion: DB_VERSION,
    includesDemoData: includeDemoData,
    counts: countsOf(data),
    data,
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_KEYED_STORES = ['projects', 'tasks', 'notes', 'focusSessions'] as const

/** validateBackup() only checks that `id` is a non-empty string; UUID-keyed tables need the stricter format before an insert can succeed. */
function assertUuidKeys(data: BackupData): void {
  for (const key of UUID_KEYED_STORES) {
    for (const record of data[key] as BaseRecord[]) {
      if (!UUID_RE.test(record.id)) {
        badRequest(`"${key}" record id "${record.id}" is not a valid UUID — this backup can't be imported as-is.`)
      }
    }
  }
}

interface TableSpec {
  table: string
  idColumn: 'id'
  insertColumns: string[]
  values: (userId: string, record: BaseRecord) => unknown[]
}

function projectSpec(): TableSpec {
  return {
    table: 'projects',
    idColumn: 'id',
    insertColumns: [
      'id', 'user_id', 'name', 'description', 'status', 'priority', 'start_date', 'target_date', 'color', 'is_demo', 'created_at', 'updated_at',
    ],
    values: (userId, r) => {
      const p = r as unknown as { name: string; description: string; status: string; priority?: string; startDate?: string; targetDate?: string; color: string }
      return [r.id, userId, p.name, p.description, p.status, p.priority ?? 'medium', p.startDate ?? null, p.targetDate ?? null, p.color, r.isDemo ?? false, r.createdAt, r.updatedAt]
    },
  }
}

function taskSpec(): TableSpec {
  return {
    table: 'tasks',
    idColumn: 'id',
    insertColumns: [
      'id', 'user_id', 'project_id', 'title', 'notes', 'status', 'priority', 'due_date', 'completed_at', 'recurrence', 'recurrence_parent_id', 'reminder_at', 'is_demo', 'created_at', 'updated_at',
    ],
    values: (userId, r) => {
      const t = r as unknown as {
        projectId?: string; title: string; notes: string; status: string; priority: string; dueDate?: string
        completedAt?: string; recurrence?: unknown; recurrenceParentId?: string; reminderAt?: string
      }
      return [
        r.id, userId, t.projectId ?? null, t.title, t.notes, t.status, t.priority, t.dueDate ?? null, t.completedAt ?? null,
        t.recurrence ? JSON.stringify(t.recurrence) : null, t.recurrenceParentId ?? null, t.reminderAt ?? null, r.isDemo ?? false, r.createdAt, r.updatedAt,
      ]
    },
  }
}

function noteSpec(): TableSpec {
  return {
    table: 'notes',
    idColumn: 'id',
    insertColumns: ['id', 'user_id', 'project_id', 'title', 'content', 'tags', 'pinned', 'is_demo', 'created_at', 'updated_at'],
    values: (userId, r) => {
      const n = r as unknown as { projectId?: string; title: string; content: string; tags: string[]; pinned?: boolean }
      return [r.id, userId, n.projectId ?? null, n.title, n.content, n.tags, n.pinned ?? false, r.isDemo ?? false, r.createdAt, r.updatedAt]
    },
  }
}

function focusSessionSpec(): TableSpec {
  return {
    table: 'focus_sessions',
    idColumn: 'id',
    insertColumns: [
      'id', 'user_id', 'task_id', 'project_id', 'started_at', 'ended_at', 'duration_minutes', 'note', 'type', 'status',
      'planned_duration_minutes', 'accumulated_ms', 'resumed_at', 'is_demo', 'created_at', 'updated_at',
    ],
    values: (userId, r) => {
      const f = r as unknown as {
        taskId?: string; projectId?: string; startedAt: string; endedAt?: string; durationMinutes: number; note: string
        type?: string; status?: string; plannedDurationMinutes?: number; accumulatedMs?: number; resumedAt?: string
      }
      return [
        r.id, userId, f.taskId ?? null, f.projectId ?? null, f.startedAt, f.endedAt ?? null, f.durationMinutes, f.note,
        f.type ?? null, f.status ?? null, f.plannedDurationMinutes ?? null, f.accumulatedMs ?? null, f.resumedAt ?? null,
        r.isDemo ?? false, r.createdAt, r.updatedAt,
      ]
    },
  }
}

/**
 * `id` is a global primary key (required so FKs like tasks.project_id and
 * tasks.recurrence_parent_id can reference it directly), not scoped per
 * user — so a plain `ON CONFLICT (id) DO UPDATE` would silently overwrite
 * another user's row if an incoming record's id ever collided with one
 * (a guessed/leaked UUID, or two accounts that each imported the same
 * pre-migration local id). The `WHERE <table>.user_id = excluded.user_id`
 * clause makes the UPDATE a no-op whenever the existing row belongs to a
 * different user — found and fixed in the V1.1 security audit; callers
 * must still pre-check for foreign-owned ids themselves (see
 * partitionByForeignConflict) to report an honest count instead of a
 * silently-dropped record, but this is the guarantee that actually
 * prevents the overwrite even if that pre-check is ever wrong or bypassed.
 */
async function upsertRecord(sql: Sql, spec: TableSpec, userId: string, record: BaseRecord): Promise<void> {
  const placeholders = spec.insertColumns.map((_, i) => `$${i + 1}`).join(', ')
  const updateSet = spec.insertColumns
    .filter((c) => c !== 'id' && c !== 'user_id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')
  await sql.query(
    `insert into ${spec.table} (${spec.insertColumns.join(', ')}) values (${placeholders})
     on conflict (id) do update set ${updateSet}
     where ${spec.table}.user_id = excluded.user_id`,
    spec.values(userId, record),
  )
}

async function deleteAllForUser(sql: Sql, table: string, userId: string): Promise<void> {
  await sql.query(`delete from ${table} where user_id = $1`, [userId])
}

/**
 * Splits incoming records into those safe to write and those whose id
 * already belongs to a *different* user — which must never be written,
 * reported as skipped instead. This is an explicit, accurate, driver-
 * independent check (rather than inferring it from upsertRecord's
 * RETURNING result, which isn't reliable across drivers for a
 * WHERE-guarded conflict update).
 */
async function partitionByForeignConflict(
  sql: Sql,
  table: string,
  userId: string,
  incoming: BaseRecord[],
): Promise<{ safe: BaseRecord[]; foreignConflicts: number }> {
  if (incoming.length === 0) return { safe: [], foreignConflicts: 0 }
  const ids = incoming.map((r) => r.id)
  // An `IN (...)` list of individual placeholders, not `= ANY($1)` with an
  // array parameter — verified empirically that pg-mem's uuid-array
  // parameter type inference doesn't match real rows via ANY(), while the
  // plain IN-list form works identically on both pg-mem and real Postgres.
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
  const { rows } = await sql.query<{ id: string }>(
    `select id from ${table} where user_id <> $1 and id in (${placeholders})`,
    [userId, ...ids],
  )
  if (rows.length === 0) return { safe: incoming, foreignConflicts: 0 }
  const foreignIds = new Set(rows.map((r) => r.id))
  return {
    safe: incoming.filter((r) => !foreignIds.has(r.id)),
    foreignConflicts: foreignIds.size,
  }
}

const SPECS: Record<'projects' | 'tasks' | 'notes' | 'focusSessions', TableSpec> = {
  projects: projectSpec(),
  tasks: taskSpec(),
  notes: noteSpec(),
  focusSessions: focusSessionSpec(),
}

/**
 * Hosted equivalent of src/data/backup.ts's restoreBackup(): same two
 * strategies, same per-record merge rule (decideMergeAction, imported from
 * the shared validation module so client and server agree byte-for-byte),
 * now scoped to `user_id` and wrapped in a Postgres transaction instead of
 * an IndexedDB one — "replace" clears only this user's rows, never another
 * user's or the whole table.
 */
export async function restoreBackupForUser(
  sql: SqlPool,
  userId: string,
  backup: LifeGridBackup,
  strategy: RestoreStrategy,
): Promise<RestoreResult> {
  assertUuidKeys(backup.data)
  const counts = {} as RestoreCounts

  await withTransaction(sql, async (tx) => {
    for (const key of Object.keys(SPECS) as (keyof typeof SPECS)[]) {
      const spec = SPECS[key]
      const incoming = backup.data[key] as BaseRecord[]

      // Never attempt to write a record whose id already belongs to a
      // different user — regardless of strategy. upsertRecord's SQL-level
      // WHERE guard would no-op such a write anyway, but filtering here
      // first means the count reported back is honest (a dropped record
      // shows up as "skipped," not silently missing) rather than relying
      // on a defense-in-depth layer to merely avoid data corruption.
      const { safe, foreignConflicts } = await partitionByForeignConflict(tx, spec.table, userId, incoming)

      if (strategy === 'replace') {
        await deleteAllForUser(tx, spec.table, userId)
        for (const record of safe) await upsertRecord(tx, spec, userId, record)
        counts[key] = { added: safe.length, updated: 0, skipped: foreignConflicts }
        continue
      }

      const { rows: existingRows } = await tx.query<{ id: string } & Record<string, unknown>>(
        `select * from ${spec.table} where user_id = $1`,
        [userId],
      )
      const existingById = new Map(
        existingRows.map((row) => [row.id, { id: row.id, updatedAt: String(row.updated_at), isDemo: Boolean(row.is_demo) } as BaseRecord]),
      )
      let added = 0
      let updated = 0
      let skipped = foreignConflicts
      for (const record of safe) {
        const action = decideMergeAction(record, existingById.get(record.id))
        if (action === 'skip') {
          skipped++
          continue
        }
        await upsertRecord(tx, spec, userId, record)
        if (action === 'add') added++
        else updated++
      }
      counts[key] = { added, updated, skipped }
    }

    // dailyPlans / weeklyReviews use a composite (user_id, id) key rather
    // than a standalone uuid, so they go through their own upsert, not the
    // uuid-keyed TableSpec machinery above.
    counts.dailyPlans = await restoreDailyPlans(tx, userId, backup.data.dailyPlans, strategy)
    counts.weeklyReviews = await restoreWeeklyReviews(tx, userId, backup.data.weeklyReviews, strategy)
  })

  return { strategy, counts }
}

async function restoreDailyPlans(
  sql: Sql,
  userId: string,
  incoming: BackupData['dailyPlans'],
  strategy: RestoreStrategy,
): Promise<RestoreCounts['dailyPlans']> {
  if (strategy === 'replace') await sql.query('delete from daily_plans where user_id = $1', [userId])
  const { rows: existingRows } = await sql.query<{ id: string; updated_at: unknown; is_demo: boolean }>(
    'select id, updated_at, is_demo from daily_plans where user_id = $1',
    [userId],
  )
  const existingById = new Map(
    existingRows.map((r) => [r.id, { id: r.id, updatedAt: String(r.updated_at), isDemo: r.is_demo } as BaseRecord]),
  )
  let added = 0
  let updated = 0
  let skipped = 0
  for (const plan of incoming) {
    const action = strategy === 'replace' ? 'add' : decideMergeAction(plan, existingById.get(plan.id))
    if (action === 'skip') {
      skipped++
      continue
    }
    await sql.query(
      `insert into daily_plans (user_id, id, task_ids, is_demo, created_at, updated_at) values ($1,$2,$3,$4,$5,$6)
       on conflict (user_id, id) do update set task_ids = excluded.task_ids, is_demo = excluded.is_demo, updated_at = excluded.updated_at`,
      [userId, plan.id, plan.taskIds, plan.isDemo ?? false, plan.createdAt, plan.updatedAt],
    )
    if (action === 'add') added++
    else updated++
  }
  return { added, updated, skipped }
}

async function restoreWeeklyReviews(
  sql: Sql,
  userId: string,
  incoming: BackupData['weeklyReviews'],
  strategy: RestoreStrategy,
): Promise<RestoreCounts['weeklyReviews']> {
  if (strategy === 'replace') await sql.query('delete from weekly_reviews where user_id = $1', [userId])
  const { rows: existingRows } = await sql.query<{ id: string; updated_at: unknown; is_demo: boolean }>(
    'select id, updated_at, is_demo from weekly_reviews where user_id = $1',
    [userId],
  )
  const existingById = new Map(
    existingRows.map((r) => [r.id, { id: r.id, updatedAt: String(r.updated_at), isDemo: r.is_demo } as BaseRecord]),
  )
  let added = 0
  let updated = 0
  let skipped = 0
  for (const review of incoming) {
    const action = strategy === 'replace' ? 'add' : decideMergeAction(review, existingById.get(review.id))
    if (action === 'skip') {
      skipped++
      continue
    }
    await sql.query(
      `insert into weekly_reviews (user_id, id, week_start, wins, blockers, lessons, next_steps, is_demo, created_at, updated_at)
       values ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (user_id, id) do update set
         wins = excluded.wins, blockers = excluded.blockers, lessons = excluded.lessons, next_steps = excluded.next_steps,
         is_demo = excluded.is_demo, updated_at = excluded.updated_at`,
      [userId, review.id, review.wins, review.blockers, review.lessons, review.nextSteps, review.isDemo ?? false, review.createdAt, review.updatedAt],
    )
    if (action === 'add') added++
    else updated++
  }
  return { added, updated, skipped }
}

/** Deletes every non-demo record owned by this user, across all tables, in one transaction. Demo records are left untouched. */
export async function clearAllRealDataForUser(sql: SqlPool, userId: string): Promise<void> {
  await withTransaction(sql, async (tx) => {
    await tx.query('delete from projects where user_id = $1 and is_demo = false', [userId])
    await tx.query('delete from tasks where user_id = $1 and is_demo = false', [userId])
    await tx.query('delete from notes where user_id = $1 and is_demo = false', [userId])
    await tx.query('delete from focus_sessions where user_id = $1 and is_demo = false', [userId])
    await tx.query('delete from daily_plans where user_id = $1 and is_demo = false', [userId])
    await tx.query('delete from weekly_reviews where user_id = $1 and is_demo = false', [userId])
  })
}
