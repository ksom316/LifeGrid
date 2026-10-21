import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  clearedSessionCookie,
  createSession,
  deleteSession,
  hashPassword,
  normalizeEmail,
  parseCookies,
  resolveSession,
  sessionCookie,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from '../auth.js'
import { getPool } from '../db.js'
import { badRequest, HttpError, readJsonBody, requireMethod } from '../http.js'
import { clientIp, enforceRateLimit } from '../rateLimit.js'
import { asRecord, requireString } from '../validation.js'
import { createUser, findUserByEmail } from '../repositories/users.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Bodies moved verbatim out of the former api/auth/{login,logout,session,signup}.ts
 * (each was `export default withErrorHandling(async (req, res) => {...})`) — only
 * the wrapper is gone, since api/auth.ts now applies withErrorHandling exactly
 * once and dispatches to these by `?action=`. No behavior changed.
 */

export async function handleLogin(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['POST'])) return
  const body = asRecord(readJsonBody(req), 'Request body')
  const email = requireString(body.email, 'email', { maxLength: 320 })
  const password = requireString(body.password, 'password', { maxLength: 200 })

  const sql = getPool()
  await enforceRateLimit(sql, `login:email:${normalizeEmail(email)}`, { maxAttempts: 10, windowSeconds: 15 * 60 })
  await enforceRateLimit(sql, `login:ip:${clientIp(req)}`, { maxAttempts: 30, windowSeconds: 15 * 60 })

  const user = await findUserByEmail(sql, email)
  const invalidCredentials = () => new HttpError(401, 'Invalid email or password.')
  if (!user) throw invalidCredentials()

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) throw invalidCredentials()

  const session = await createSession(sql, user.id)
  res.setHeader('Set-Cookie', sessionCookie(session.token, session.expiresAt))
  res.status(200).json({ user: { id: user.id, email: user.email } })
}

export async function handleLogout(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['POST'])) return
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[SESSION_COOKIE_NAME]
  if (token) await deleteSession(getPool(), token)
  res.setHeader('Set-Cookie', clearedSessionCookie())
  res.status(204).end()
}

export async function handleSession(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return
  const cookies = parseCookies(req.headers.cookie)
  const user = await resolveSession(getPool(), cookies[SESSION_COOKIE_NAME])
  if (!user) {
    res.status(401).json({ user: null })
    return
  }
  res.status(200).json({ user })
}

export async function handleSignup(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['POST'])) return
  const body = asRecord(readJsonBody(req), 'Request body')
  const email = requireString(body.email, 'email', { maxLength: 320 })
  const password = requireString(body.password, 'password', { maxLength: 200 })

  if (!EMAIL_RE.test(email)) badRequest('"email" is not a valid email address.')
  if (password.length < 8) badRequest('Password must be at least 8 characters.')

  const sql = getPool()
  await enforceRateLimit(sql, `signup:email:${normalizeEmail(email)}`, { maxAttempts: 5, windowSeconds: 60 * 60 })
  await enforceRateLimit(sql, `signup:ip:${clientIp(req)}`, { maxAttempts: 20, windowSeconds: 60 * 60 })

  const existing = await findUserByEmail(sql, email)
  if (existing) badRequest('An account with this email already exists.')

  const passwordHash = await hashPassword(password)
  const user = await createUser(sql, email, passwordHash)
  const session = await createSession(sql, user.id)

  res.setHeader('Set-Cookie', sessionCookie(session.token, session.expiresAt))
  res.status(201).json({ user: { id: user.id, email: user.email } })
}
