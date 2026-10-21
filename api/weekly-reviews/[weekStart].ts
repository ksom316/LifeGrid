import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, readJsonBody, requireMethod, withAuth } from '../../server/http.js'
import { asRecord, optionalString } from '../../server/validation.js'
import { getWeeklyReview, upsertWeeklyReview } from '../../server/repositories/weeklyReviews.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET', 'PUT'])) return
  const weekStart = req.query.weekStart
  if (typeof weekStart !== 'string' || !DATE_RE.test(weekStart)) return notFound('Invalid week.')

  if (req.method === 'GET') {
    const review = await getWeeklyReview(sql, user.id, weekStart)
    if (!review) return notFound('No review for this week yet.')
    res.status(200).json({ weeklyReview: review })
    return
  }

  const body = asRecord(readJsonBody(req), 'Request body')
  const review = await upsertWeeklyReview(sql, user.id, weekStart, {
    wins: optionalString(body.wins, 'wins', { maxLength: 20_000 }) ?? '',
    blockers: optionalString(body.blockers, 'blockers', { maxLength: 20_000 }) ?? '',
    lessons: optionalString(body.lessons, 'lessons', { maxLength: 20_000 }) ?? '',
    nextSteps: optionalString(body.nextSteps, 'nextSteps', { maxLength: 20_000 }) ?? '',
  })
  res.status(200).json({ weeklyReview: review })
})
