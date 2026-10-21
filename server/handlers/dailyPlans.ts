import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthedContext } from '../http.js'
import { badRequest, notFound, readJsonBody, requireMethod } from '../http.js'
import { asRecord, requireString } from '../validation.js'
import { addDailyPriority, getDailyPlan, listDailyPlans, removeDailyPriority } from '../repositories/dailyPlans.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Bodies moved verbatim out of the former api/daily-plans/{index,[date]}.ts. */

export async function handleDailyPlansIndex(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return
  res.status(200).json({ dailyPlans: await listDailyPlans(sql, user.id) })
}

export async function handleDailyPlanByDate(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'POST', 'DELETE'])) return
  const date = req.query.date
  if (typeof date !== 'string' || !DATE_RE.test(date)) return notFound('Invalid date.')

  if (req.method === 'GET') {
    res.status(200).json({ dailyPlan: await getDailyPlan(sql, user.id, date) })
    return
  }

  const body = asRecord(readJsonBody(req), 'Request body')
  const taskId = requireString(body.taskId, 'taskId')

  if (req.method === 'POST') {
    res.status(200).json({ dailyPlan: await addDailyPriority(sql, user.id, date, taskId) })
    return
  }

  if (req.method === 'DELETE') {
    res.status(200).json({ dailyPlan: await removeDailyPriority(sql, user.id, date, taskId) })
    return
  }

  badRequest('Unsupported method.')
}
