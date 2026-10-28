import type { Sql } from '../db.js'
import { toDateTimeString } from '../mapping.js'
import type { TagColor } from '../../src/types/domain.js'
import type { PaletteColor } from '../../src/utils/colors.js'

interface TagColorRow {
  id: string
  color: string
  is_demo: boolean
  created_at: unknown
  updated_at: unknown
}

function mapRow(row: TagColorRow): TagColor {
  return {
    id: row.id,
    color: row.color as PaletteColor,
    isDemo: row.is_demo || undefined,
    createdAt: toDateTimeString(row.created_at),
    updatedAt: toDateTimeString(row.updated_at),
  }
}

export async function listTagColors(sql: Sql, userId: string): Promise<TagColor[]> {
  const { rows } = await sql.query<TagColorRow>('select * from tag_colors where user_id = $1 order by id', [userId])
  return rows.map(mapRow)
}

export async function setTagColor(sql: Sql, userId: string, tag: string, color: PaletteColor): Promise<TagColor> {
  const now = new Date().toISOString()
  const { rows } = await sql.query<TagColorRow>(
    `insert into tag_colors (user_id, id, color, created_at, updated_at)
     values ($1,$2,$3,$4,$4)
     on conflict (user_id, id) do update set color = excluded.color, updated_at = excluded.updated_at
     returning *`,
    [userId, tag, color, now],
  )
  return mapRow(rows[0])
}

export async function removeTagColor(sql: Sql, userId: string, tag: string): Promise<void> {
  await sql.query('delete from tag_colors where user_id = $1 and id = $2', [userId, tag])
}
