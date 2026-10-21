import { randomUUID } from 'node:crypto'
import type { Sql } from '../db.js'
import { normalizeEmail } from '../auth.js'

export interface UserRow {
  id: string
  email: string
  password_hash: string
}

export async function findUserByEmail(sql: Sql, email: string): Promise<UserRow | undefined> {
  const { rows } = await sql.query<UserRow>('select id, email, password_hash from users where email_normalized = $1', [
    normalizeEmail(email),
  ])
  return rows[0]
}

export async function createUser(sql: Sql, email: string, passwordHash: string): Promise<UserRow> {
  const id = randomUUID()
  const now = new Date().toISOString()
  await sql.query(
    'insert into users (id, email, email_normalized, password_hash, created_at, updated_at) values ($1,$2,$3,$4,$5,$5)',
    [id, email.trim(), normalizeEmail(email), passwordHash, now],
  )
  return { id, email: email.trim(), password_hash: passwordHash }
}
