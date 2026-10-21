import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../server/http.js'
import { handleExport, handleLocalImport, handlePreview, handleRestore } from '../server/handlers/backup.js'

/**
 * Serves /api/backup/export, /api/backup/local-import, /api/backup/preview,
 * and /api/backup/restore — formerly four Vercel Functions, now one (see
 * vercel.json's rewrites, each mapping one literal path here with
 * `?action=<name>`). Unrecognized actions 404.
 */
export default withAuth(async (req: VercelRequest, res: VercelResponse, ctx) => {
  const action = req.query.action
  switch (action) {
    case 'export':
      return handleExport(req, res, ctx)
    case 'local-import':
      return handleLocalImport(req, res, ctx)
    case 'preview':
      return handlePreview(req, res, ctx)
    case 'restore':
      return handleRestore(req, res, ctx)
    default:
      res.status(404).json({ error: 'Not found' })
  }
})
