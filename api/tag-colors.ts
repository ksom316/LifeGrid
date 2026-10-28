import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../server/http.js'
import { handleTagColors } from '../server/handlers/tagColors.js'

export default withAuth(async (req: VercelRequest, res: VercelResponse, ctx) => {
  return handleTagColors(req, res, ctx)
})
