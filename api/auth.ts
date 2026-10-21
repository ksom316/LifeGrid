import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withErrorHandling } from '../server/http.js'
import { handleLogin, handleLogout, handleSession, handleSignup } from '../server/handlers/auth.js'

/**
 * Serves /api/auth/login, /api/auth/logout, /api/auth/session, and
 * /api/auth/signup — formerly four separate Vercel Functions, now one, to
 * stay under the Hobby plan's 12-function limit. vercel.json rewrites each
 * of those four literal paths here with `?action=<name>` (not a dynamic
 * segment — these are fixed, known literal paths, so no path-segment
 * parsing/validation is needed beyond this exact switch). Hitting this
 * function directly with an unrecognized `action` — whether via the real
 * routes or by querying /api/auth itself, which is also reachable — 404s
 * rather than falling through to any handler.
 */
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const action = req.query.action
  switch (action) {
    case 'login':
      return handleLogin(req, res)
    case 'logout':
      return handleLogout(req, res)
    case 'session':
      return handleSession(req, res)
    case 'signup':
      return handleSignup(req, res)
    default:
      res.status(404).json({ error: 'Not found' })
  }
})
