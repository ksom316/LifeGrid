import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../server/http.js'
import { handleDailyPlanByDate, handleDailyPlansIndex } from '../server/handlers/dailyPlans.js'

/**
 * Serves /api/daily-plans (this file's own default route — no rewrite
 * needed) and /api/daily-plans/:date (rewritten in vercel.json to
 * `?date=:date`). Formerly two Vercel Functions, now one.
 */
export default withAuth(async (req: VercelRequest, res: VercelResponse, ctx) => {
  if (req.query.date === undefined) return handleDailyPlansIndex(req, res, ctx)
  return handleDailyPlanByDate(req, res, ctx)
})
