import type { VercelRequest, VercelResponse } from '@vercel/node'
import { badRequest, notFound, readJsonBody, requireMethod, withAuth } from '../../server/http.js'
import { asRecord, requireString } from '../../server/validation.js'
import { addDailyPriority, getDailyPlan, removeDailyPriority } from '../../server/repositories/dailyPlans.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
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
})
