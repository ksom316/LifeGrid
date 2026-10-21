import { randomUUID } from 'node:crypto'
import type { Sql } from '../db.js'
import { notFound } from '../http.js'
import { assertOwnsProject } from '../ownership.js'
import { toDateTimeString } from '../mapping.js'
import type { Note } from '../../src/types/domain.js'

interface NoteRow {
  id: string
  project_id: string | null
  title: string
  content: string
  tags: string[]
  pinned: boolean
  is_demo: boolean
  created_at: unknown
  updated_at: unknown
}

function mapRow(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags,
    projectId: row.project_id ?? undefined,
    pinned: row.pinned,
    isDemo: row.is_demo || undefined,
    createdAt: toDateTimeString(row.created_at),
    updatedAt: toDateTimeString(row.updated_at),
  }
}

export async function listNotes(sql: Sql, userId: string): Promise<Note[]> {
  const { rows } = await sql.query<NoteRow>('select * from notes where user_id = $1 order by updated_at desc', [userId])
  return rows.map(mapRow)
}

export async function getNote(sql: Sql, userId: string, id: string): Promise<Note | undefined> {
  const { rows } = await sql.query<NoteRow>('select * from notes where user_id = $1 and id = $2', [userId, id])
  return rows[0] ? mapRow(rows[0]) : undefined
}

export interface CreateNoteInput {
  id?: string
  title: string
  content?: string
  tags?: string[]
  projectId?: string
  pinned?: boolean
  isDemo?: boolean
  createdAt?: string
  updatedAt?: string
}

export async function createNote(sql: Sql, userId: string, input: CreateNoteInput): Promise<Note> {
  if (input.projectId) await assertOwnsProject(sql, userId, input.projectId)
  const id = input.id ?? randomUUID()
  const now = new Date().toISOString()
  await sql.query(
    `insert into notes (id, user_id, project_id, title, content, tags, pinned, is_demo, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      userId,
      input.projectId ?? null,
      input.title,
      input.content ?? '',
      input.tags ?? [],
      input.pinned ?? false,
      input.isDemo ?? false,
      input.createdAt ?? now,
      input.updatedAt ?? now,
    ],
  )
  return (await getNote(sql, userId, id))!
}

export interface UpdateNoteInput {
  title?: string
  content?: string
  tags?: string[]
  projectId?: string | null
  pinned?: boolean
}

export async function updateNote(sql: Sql, userId: string, id: string, patch: UpdateNoteInput): Promise<Note> {
  const existing = await getNote(sql, userId, id)
  if (!existing) notFound('Note not found.')
  if (patch.projectId) await assertOwnsProject(sql, userId, patch.projectId)

  const next = {
    title: patch.title ?? existing.title,
    content: patch.content ?? existing.content,
    tags: patch.tags ?? existing.tags,
    project_id: patch.projectId === undefined ? (existing.projectId ?? null) : patch.projectId,
    pinned: patch.pinned ?? existing.pinned ?? false,
  }
  await sql.query(
    `update notes set title=$1, content=$2, tags=$3, project_id=$4, pinned=$5, updated_at=$6 where user_id = $7 and id = $8`,
    [next.title, next.content, next.tags, next.project_id, next.pinned, new Date().toISOString(), userId, id],
  )
  return (await getNote(sql, userId, id))!
}

export async function removeNote(sql: Sql, userId: string, id: string): Promise<void> {
  const existing = await getNote(sql, userId, id)
  if (!existing) notFound('Note not found.')
  await sql.query('delete from notes where user_id = $1 and id = $2', [userId, id])
}
