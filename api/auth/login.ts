import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSession, normalizeEmail, sessionCookie, verifyPassword } from '../../server/auth.ts'
import { getPool } from '../../server/db.ts'
import { HttpError, readJsonBody, requireMethod, withErrorHandling } from '../../server/http.ts'
import { clientIp, enforceRateLimit } from '../../server/rateLimit.ts'
import { asRecord, requireString } from '../../server/validation.ts'
import { findUserByEmail } from '../../server/repositories/users.ts'

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ['POST'])) return
  const body = asRecord(readJsonBody(req), 'Request body')
  const email = requireString(body.email, 'email', { maxLength: 320 })
  const password = requireString(body.password, 'password', { maxLength: 200 })

  const sql = getPool()
  // Limits every attempt (successful or not) against this email and this
  // source IP, before touching the password hash — brute-forcing one
  // account or spraying many from one source both get throttled.
  await enforceRateLimit(sql, `login:email:${normalizeEmail(email)}`, { maxAttempts: 10, windowSeconds: 15 * 60 })
  await enforceRateLimit(sql, `login:ip:${clientIp(req)}`, { maxAttempts: 30, windowSeconds: 15 * 60 })

  const user = await findUserByEmail(sql, email)
  // Same error for "no such user" and "wrong password" — never reveal
  // which part was wrong, so an attacker can't use this endpoint to
  // enumerate registered email addresses.
  const invalidCredentials = () => new HttpError(401, 'Invalid email or password.')
  if (!user) throw invalidCredentials()

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) throw invalidCredentials()

  const session = await createSession(sql, user.id)
  res.setHeader('Set-Cookie', sessionCookie(session.token, session.expiresAt))
  res.status(200).json({ user: { id: user.id, email: user.email } })
})
