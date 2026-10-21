import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, requireMethod, withAuth } from '../../../server/http.ts'
import { completeTask } from '../../../server/repositories/tasks.ts'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['POST'])) return
  const id = req.query.id
  if (typeof id !== 'string') return notFound('Task not found.')

  const result = await completeTask(sql, user.id, id)
  res.status(200).json(result)
})
