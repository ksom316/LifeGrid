import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSession, hashPassword, normalizeEmail, sessionCookie } from '../../server/auth.ts'
import { getPool } from '../../server/db.ts'
import { badRequest, readJsonBody, requireMethod, withErrorHandling } from '../../server/http.ts'
import { clientIp, enforceRateLimit } from '../../server/rateLimit.ts'
import { asRecord, requireString } from '../../server/validation.ts'
import { createUser, findUserByEmail } from '../../server/repositories/users.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ['POST'])) return
  const body = asRecord(readJsonBody(req), 'Request body')
  const email = requireString(body.email, 'email', { maxLength: 320 })
  const password = requireString(body.password, 'password', { maxLength: 200 })

  if (!EMAIL_RE.test(email)) badRequest('"email" is not a valid email address.')
  if (password.length < 8) badRequest('Password must be at least 8 characters.')

  const sql = getPool()
  // Two independent limits: per-email (stop repeated signup attempts
  // against one target address) and per-IP (stop mass account creation
  // from one source trying many addresses) — see server/rateLimit.ts.
  await enforceRateLimit(sql, `signup:email:${normalizeEmail(email)}`, { maxAttempts: 5, windowSeconds: 60 * 60 })
  await enforceRateLimit(sql, `signup:ip:${clientIp(req)}`, { maxAttempts: 20, windowSeconds: 60 * 60 })

  const existing = await findUserByEmail(sql, email)
  if (existing) badRequest('An account with this email already exists.')

  const passwordHash = await hashPassword(password)
  const user = await createUser(sql, email, passwordHash)
  const session = await createSession(sql, user.id)

  res.setHeader('Set-Cookie', sessionCookie(session.token, session.expiresAt))
  res.status(201).json({ user: { id: user.id, email: user.email } })
})
