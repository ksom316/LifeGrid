import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, requireMethod, withAuth } from '../../server/http.ts'
import { getFocusSession, removeFocusSession } from '../../server/repositories/focusSessions.ts'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET', 'DELETE'])) return
  const id = req.query.id
  if (typeof id !== 'string') return notFound('Focus session not found.')

  if (req.method === 'GET') {
    const session = await getFocusSession(sql, user.id, id)
    if (!session) return notFound('Focus session not found.')
    res.status(200).json({ focusSession: session })
    return
  }

  await removeFocusSession(sql, user.id, id)
  res.status(204).end()
})
