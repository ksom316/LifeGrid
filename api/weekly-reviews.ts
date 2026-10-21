import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, withAuth } from '../server/http.js'
import { handleWeeklyReviewByWeek, handleWeeklyReviewsIndex } from '../server/handlers/weeklyReviews.js'

/**
 * Serves /api/weekly-reviews (this file's own default route) and
 * /api/weekly-reviews/:weekStart (rewritten in vercel.json to
 * `?weekStart=:weekStart`). Formerly two Vercel Functions, now one.
 */
export default withAuth(async (req: VercelRequest, res: VercelResponse, ctx) => {
  const weekStart = req.query.weekStart
  if (weekStart === undefined) return handleWeeklyReviewsIndex(req, res, ctx)
  if (typeof weekStart !== 'string') return notFound('Invalid week.')
  return handleWeeklyReviewByWeek(req, res, ctx, weekStart)
})
