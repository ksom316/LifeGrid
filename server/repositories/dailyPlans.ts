import type { Sql } from '../db.js'
import { toDateTimeString } from '../mapping.js'
import type { DailyPlan } from '../../src/types/domain.js'

interface DailyPlanRow {
  id: string
  task_ids: string[]
  is_demo: boolean
  created_at: unknown
  updated_at: unknown
}

function mapRow(row: DailyPlanRow): DailyPlan {
  return {
    id: row.id,
    taskIds: row.task_ids,
    isDemo: row.is_demo || undefined,
    createdAt: toDateTimeString(row.created_at),
    updatedAt: toDateTimeString(row.updated_at),
  }
}

function emptyPlan(date: string): DailyPlan {
  const now = new Date().toISOString()
  return { id: date, taskIds: [], createdAt: now, updatedAt: now }
}

/** Never returns undefined — mirrors src/data/dailyPlans.ts's get(), which synthesizes an empty plan for a date with no record yet. */
export async function getDailyPlan(sql: Sql, userId: string, date: string): Promise<DailyPlan> {
  const { rows } = await sql.query<DailyPlanRow>('select * from daily_plans where user_id = $1 and id = $2', [
    userId,
    date,
  ])
  return rows[0] ? mapRow(rows[0]) : emptyPlan(date)
}

export async function listDailyPlans(sql: Sql, userId: string): Promise<DailyPlan[]> {
  const { rows } = await sql.query<DailyPlanRow>('select * from daily_plans where user_id = $1 order by id desc', [
    userId,
  ])
  return rows.map(mapRow)
}

async function upsertTaskIds(sql: Sql, userId: string, date: string, taskIds: string[]): Promise<DailyPlan> {
  const now = new Date().toISOString()
  await sql.query(
    `insert into daily_plans (user_id, id, task_ids, created_at, updated_at)
     values ($1,$2,$3,$4,$4)
     on conflict (user_id, id) do update set task_ids = excluded.task_ids, updated_at = excluded.updated_at`,
    [userId, date, taskIds, now],
  )
  return getDailyPlan(sql, userId, date)
}

export async function addDailyPriority(sql: Sql, userId: string, date: string, taskId: string): Promise<DailyPlan> {
  const current = await getDailyPlan(sql, userId, date)
  if (current.taskIds.includes(taskId)) return current
  return upsertTaskIds(sql, userId, date, [...current.taskIds, taskId])
}

export async function removeDailyPriority(sql: Sql, userId: string, date: string, taskId: string): Promise<DailyPlan> {
  const current = await getDailyPlan(sql, userId, date)
  return upsertTaskIds(sql, userId, date, current.taskIds.filter((id) => id !== taskId))
}
