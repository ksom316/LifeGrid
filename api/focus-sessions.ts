import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, withAuth } from '../server/http.js'
import {
  handleFocusSessionById,
  handleFocusSessionComplete,
  handleFocusSessionPause,
  handleFocusSessionResume,
  handleFocusSessionsIndex,
} from '../server/handlers/focusSessions.js'

/**
 * Serves /api/focus-sessions (this file's own default route), and
 * /api/focus-sessions/:id, /:id/pause, /:id/resume, /:id/complete
 * (rewritten in vercel.json to `?id=:id` and `?id=:id&action=<name>`).
 * Formerly five Vercel Functions, now one. An `id` present with an
 * unrecognized `action` — or any shape not listed below — 404s rather than
 * falling through to the plain by-id handler.
 */
export default withAuth(async (req: VercelRequest, res: VercelResponse, ctx) => {
  const id = req.query.id
  if (id === undefined) return handleFocusSessionsIndex(req, res, ctx)
  if (typeof id !== 'string') return notFound('Focus session not found.')

  const action = req.query.action
  if (action === undefined) return handleFocusSessionById(req, res, ctx, id)
  if (action === 'pause') return handleFocusSessionPause(req, res, ctx, id)
  if (action === 'resume') return handleFocusSessionResume(req, res, ctx, id)
  if (action === 'complete') return handleFocusSessionComplete(req, res, ctx, id)

  res.status(404).json({ error: 'Not found' })
})
