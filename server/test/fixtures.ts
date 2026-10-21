import { createSession, hashPassword, sessionCookie } from '../auth.ts'
import type { Sql } from '../db.ts'
import { createUser } from '../repositories/users.ts'

export interface TestUser {
  id: string
  email: string
  cookie: string
}

/** Creates a real user (through the real hashPassword/createSession code paths) and returns a ready-to-send Cookie header value. */
export async function createTestUser(sql: Sql, email: string, password = 'correct horse battery staple'): Promise<TestUser> {
  const passwordHash = await hashPassword(password)
  const user = await createUser(sql, email, passwordHash)
  const session = await createSession(sql, user.id)
  const cookieHeader = sessionCookie(session.token, session.expiresAt)
  const cookie = cookieHeader.split(';')[0] // "lg_session=<token>"
  return { id: user.id, email: user.email, cookie }
}
