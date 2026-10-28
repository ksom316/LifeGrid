import { randomUUID } from 'node:crypto'
import type { Sql } from '../db.js'
import { notFound } from '../http.js'
import { toDateStringOrUndefined, toDateTimeString } from '../mapping.js'
import { colorForKey } from '../../src/utils/colors.js'
import type { Project, ProjectColor, ProjectPriority, ProjectStatus } from '../../src/types/domain.js'

interface ProjectRow {
  id: string
  name: string
  description: string
  status: string
  priority: string | null
  start_date: unknown
  target_date: unknown
  color: string
  is_demo: boolean
  created_at: unknown
  updated_at: unknown
}

function mapRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as ProjectStatus,
    priority: (row.priority ?? undefined) as ProjectPriority | undefined,
    startDate: toDateStringOrUndefined(row.start_date),
    targetDate: toDateStringOrUndefined(row.target_date),
    color: row.color as ProjectColor,
    isDemo: row.is_demo || undefined,
    createdAt: toDateTimeString(row.created_at),
    updatedAt: toDateTimeString(row.updated_at),
  }
}

export async function listProjects(sql: Sql, userId: string): Promise<Project[]> {
  const { rows } = await sql.query<ProjectRow>('select * from projects where user_id = $1 order by updated_at desc', [
    userId,
  ])
  return rows.map(mapRow)
}

export async function getProject(sql: Sql, userId: string, id: string): Promise<Project | undefined> {
  const { rows } = await sql.query<ProjectRow>('select * from projects where user_id = $1 and id = $2', [userId, id])
  return rows[0] ? mapRow(rows[0]) : undefined
}

export interface CreateProjectInput {
  id?: string
  name: string
  description?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  startDate?: string
  targetDate?: string
  color?: ProjectColor
  isDemo?: boolean
  createdAt?: string
  updatedAt?: string
}

export async function createProject(sql: Sql, userId: string, input: CreateProjectInput): Promise<Project> {
  const id = input.id ?? randomUUID()
  const now = new Date().toISOString()
  const row = {
    id,
    name: input.name,
    description: input.description ?? '',
    status: input.status ?? 'active',
    priority: input.priority ?? 'medium',
    start_date: input.startDate ?? null,
    target_date: input.targetDate ?? null,
    color: input.color ?? colorForKey(id),
    is_demo: input.isDemo ?? false,
    created_at: input.createdAt ?? now,
    updated_at: input.updatedAt ?? now,
  }
  await sql.query(
    `insert into projects (id, user_id, name, description, status, priority, start_date, target_date, color, is_demo, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      row.id,
      userId,
      row.name,
      row.description,
      row.status,
      row.priority,
      row.start_date,
      row.target_date,
      row.color,
      row.is_demo,
      row.created_at,
      row.updated_at,
    ],
  )
  return (await getProject(sql, userId, id))!
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  startDate?: string | null
  targetDate?: string | null
  color?: ProjectColor
}

export async function updateProject(
  sql: Sql,
  userId: string,
  id: string,
  patch: UpdateProjectInput,
): Promise<Project> {
  const existing = await getProject(sql, userId, id)
  if (!existing) notFound('Project not found.')

  const next = {
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    status: patch.status ?? existing.status,
    priority: patch.priority ?? existing.priority ?? 'medium',
    start_date: patch.startDate === undefined ? (existing.startDate ?? null) : patch.startDate,
    target_date: patch.targetDate === undefined ? (existing.targetDate ?? null) : patch.targetDate,
    color: patch.color ?? existing.color,
  }
  await sql.query(
    `update projects set name=$1, description=$2, status=$3, priority=$4, start_date=$5, target_date=$6, color=$7, updated_at=$8
     where user_id = $9 and id = $10`,
    [
      next.name,
      next.description,
      next.status,
      next.priority,
      next.start_date,
      next.target_date,
      next.color,
      new Date().toISOString(),
      userId,
      id,
    ],
  )
  return (await getProject(sql, userId, id))!
}

/** Mirrors src/data/projects.ts's deletePreservingRecords: detach, don't cascade-delete, referencing tasks/notes/focus sessions. */
export async function deleteProjectPreservingRecords(sql: Sql, userId: string, id: string): Promise<void> {
  const existing = await getProject(sql, userId, id)
  if (!existing) notFound('Project not found.')
  // The FK columns are `on delete set null`, so a plain delete already
  // detaches referencing rows at the database level — no separate update
  // pass is needed (unlike the client, which has no equivalent of a DB
  // foreign key and must do this by hand).
  await sql.query('delete from projects where user_id = $1 and id = $2', [userId, id])
}
