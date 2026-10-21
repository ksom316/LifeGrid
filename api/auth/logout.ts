import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearedSessionCookie, deleteSession, parseCookies, SESSION_COOKIE_NAME } from '../../server/auth.js'
import { getPool } from '../../server/db.js'
import { requireMethod, withErrorHandling } from '../../server/http.js'

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ['POST'])) return
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[SESSION_COOKIE_NAME]
  if (token) await deleteSession(getPool(), token)
  res.setHeader('Set-Cookie', clearedSessionCookie())
  res.status(204).end()
})
