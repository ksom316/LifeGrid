import type { Sql } from '../db.ts'
import { toDateTimeString } from '../mapping.ts'
import type { WeeklyReview } from '../../src/types/domain.ts'

interface WeeklyReviewRow {
  id: string
  week_start: unknown
  wins: string
  blockers: string
  lessons: string
  next_steps: string
  is_demo: boolean
  created_at: unknown
  updated_at: unknown
}

function mapRow(row: WeeklyReviewRow): WeeklyReview {
  return {
    id: row.id,
    weekStart: row.id,
    wins: row.wins,
    blockers: row.blockers,
    lessons: row.lessons,
    nextSteps: row.next_steps,
    isDemo: row.is_demo || undefined,
    createdAt: toDateTimeString(row.created_at),
    updatedAt: toDateTimeString(row.updated_at),
  }
}

export async function listWeeklyReviews(sql: Sql, userId: string): Promise<WeeklyReview[]> {
  const { rows } = await sql.query<WeeklyReviewRow>('select * from weekly_reviews where user_id = $1 order by id desc', [
    userId,
  ])
  return rows.map(mapRow)
}

export async function getWeeklyReview(sql: Sql, userId: string, weekStart: string): Promise<WeeklyReview | undefined> {
  const { rows } = await sql.query<WeeklyReviewRow>('select * from weekly_reviews where user_id = $1 and id = $2', [
    userId,
    weekStart,
  ])
  return rows[0] ? mapRow(rows[0]) : undefined
}

export interface WeeklyReviewFields {
  wins: string
  blockers: string
  lessons: string
  nextSteps: string
}

export async function upsertWeeklyReview(
  sql: Sql,
  userId: string,
  weekStart: string,
  fields: WeeklyReviewFields,
): Promise<WeeklyReview> {
  const now = new Date().toISOString()
  await sql.query(
    `insert into weekly_reviews (user_id, id, week_start, wins, blockers, lessons, next_steps, created_at, updated_at)
     values ($1,$2,$2,$3,$4,$5,$6,$7,$7)
     on conflict (user_id, id) do update set
       wins = excluded.wins, blockers = excluded.blockers, lessons = excluded.lessons, next_steps = excluded.next_steps, updated_at = excluded.updated_at`,
    [userId, weekStart, fields.wins, fields.blockers, fields.lessons, fields.nextSteps, now],
  )
  return (await getWeeklyReview(sql, userId, weekStart))!
}
