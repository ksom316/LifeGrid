import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, readJsonBody, requireMethod, withAuth } from '../../../server/http.js'
import { asRecord } from '../../../server/validation.js'
import { finalizeFocusSession } from '../../../server/repositories/focusSessions.js'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['POST'])) return
  const id = req.query.id
  if (typeof id !== 'string') return notFound('Focus session not found.')

  const body = asRecord(readJsonBody(req), 'Request body')
  const outcome = body.outcome === 'interrupted' ? 'interrupted' : 'completed'
  res.status(200).json({ focusSession: await finalizeFocusSession(sql, user.id, id, outcome) })
})
