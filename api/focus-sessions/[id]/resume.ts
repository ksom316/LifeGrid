import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, requireMethod, withAuth } from '../../../server/http.ts'
import { resumeFocusSession } from '../../../server/repositories/focusSessions.ts'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['POST'])) return
  const id = req.query.id
  if (typeof id !== 'string') return notFound('Focus session not found.')
  res.status(200).json({ focusSession: await resumeFocusSession(sql, user.id, id) })
})
