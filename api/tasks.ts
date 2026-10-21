import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, withAuth } from '../server/http.js'
import { handleTaskById, handleTaskComplete, handleTasksIndex } from '../server/handlers/tasks.js'

/**
 * Serves /api/tasks (this file's own default route), /api/tasks/:id, and
 * /api/tasks/:id/complete (rewritten in vercel.json to `?id=:id` and
 * `?id=:id&action=complete`). Formerly three Vercel Functions, now one.
 */
export default withAuth(async (req: VercelRequest, res: VercelResponse, ctx) => {
  const id = req.query.id
  if (id === undefined) return handleTasksIndex(req, res, ctx)
  if (typeof id !== 'string') return notFound('Task not found.')

  const action = req.query.action
  if (action === undefined) return handleTaskById(req, res, ctx, id)
  if (action === 'complete') return handleTaskComplete(req, res, ctx, id)

  res.status(404).json({ error: 'Not found' })
})
