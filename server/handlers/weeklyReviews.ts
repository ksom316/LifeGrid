import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthedContext } from '../http.js'
import { notFound, readJsonBody, requireMethod } from '../http.js'
import { asRecord, optionalString } from '../validation.js'
import { getWeeklyReview, listWeeklyReviews, upsertWeeklyReview } from '../repositories/weeklyReviews.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Bodies moved verbatim out of the former api/weekly-reviews/{index,[weekStart]}.ts. */

export async function handleWeeklyReviewsIndex(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return
  res.status(200).json({ weeklyReviews: await listWeeklyReviews(sql, user.id) })
}

export async function handleWeeklyReviewByWeek(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
  weekStart: string,
): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'PUT'])) return
  if (!DATE_RE.test(weekStart)) return notFound('Invalid week.')

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
}
