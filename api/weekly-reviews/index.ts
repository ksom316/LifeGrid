import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireMethod, withAuth } from '../../server/http.js'
import { listWeeklyReviews } from '../../server/repositories/weeklyReviews.js'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET'])) return
  res.status(200).json({ weeklyReviews: await listWeeklyReviews(sql, user.id) })
})
