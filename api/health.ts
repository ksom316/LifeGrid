import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPool } from '../server/db.js'
import { requireMethod, withErrorHandling } from '../server/http.js'

/**
 * Unauthenticated on purpose (so uptime monitors don't need credentials),
 * but reveals nothing beyond "the database is reachable" — no record
 * counts, no user data, no configuration, no stack traces on failure.
 */
export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ['GET'])) return
  try {
    await getPool().query('select 1')
    res.status(200).json({ status: 'ok' })
  } catch {
    res.status(503).json({ status: 'unavailable' })
  }
})
