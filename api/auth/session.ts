import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseCookies, resolveSession, SESSION_COOKIE_NAME } from '../../server/auth.ts'
import { getPool } from '../../server/db.ts'
import { requireMethod, withErrorHandling } from '../../server/http.ts'

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ['GET'])) return
  const cookies = parseCookies(req.headers.cookie)
  const user = await resolveSession(getPool(), cookies[SESSION_COOKIE_NAME])
  if (!user) {
    res.status(401).json({ user: null })
    return
  }
  res.status(200).json({ user })
})
