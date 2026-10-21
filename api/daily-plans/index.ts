import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireMethod, withAuth } from '../../server/http.ts'
import { listDailyPlans } from '../../server/repositories/dailyPlans.ts'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET'])) return
  res.status(200).json({ dailyPlans: await listDailyPlans(sql, user.id) })
})
