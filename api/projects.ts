import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, withAuth } from '../server/http.js'
import { handleProjectById, handleProjectsIndex } from '../server/handlers/projects.js'

/**
 * Serves /api/projects (this file's own default route) and /api/projects/:id
 * (rewritten in vercel.json to `?id=:id`). Formerly two Vercel Functions,
 * now one.
 */
export default withAuth(async (req: VercelRequest, res: VercelResponse, ctx) => {
  const id = req.query.id
  if (id === undefined) return handleProjectsIndex(req, res, ctx)
  if (typeof id !== 'string') return notFound('Project not found.')
  return handleProjectById(req, res, ctx, id)
})
