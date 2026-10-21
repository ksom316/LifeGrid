import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, withAuth } from '../server/http.js'
import { handleNoteById, handleNotesIndex } from '../server/handlers/notes.js'

/**
 * Serves /api/notes (this file's own default route) and /api/notes/:id
 * (rewritten in vercel.json to `?id=:id`). Formerly two Vercel Functions,
 * now one.
 */
export default withAuth(async (req: VercelRequest, res: VercelResponse, ctx) => {
  const id = req.query.id
  if (id === undefined) return handleNotesIndex(req, res, ctx)
  if (typeof id !== 'string') return notFound('Note not found.')
  return handleNoteById(req, res, ctx, id)
})
