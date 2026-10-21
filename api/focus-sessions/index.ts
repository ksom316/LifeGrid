import type { VercelRequest, VercelResponse } from '@vercel/node'
import { badRequest, readJsonBody, requireMethod, withAuth } from '../../server/http.js'
import { asRecord, optionalDateTime, optionalString, optionalUuid } from '../../server/validation.js'
import { listFocusSessions, logFocusSession, startFocusSession } from '../../server/repositories/focusSessions.js'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET', 'POST'])) return

  if (req.method === 'GET') {
    res.status(200).json({ focusSessions: await listFocusSessions(sql, user.id) })
    return
  }

  const body = asRecord(readJsonBody(req), 'Request body')
  const mode = body.mode

  if (mode === 'start') {
    const plannedDurationMinutes = body.plannedDurationMinutes
    if (typeof plannedDurationMinutes !== 'number' || plannedDurationMinutes <= 0) {
      badRequest('"plannedDurationMinutes" must be a positive number.')
    }
    const session = await startFocusSession(sql, user.id, {
      plannedDurationMinutes,
      projectId: optionalUuid(body.projectId, 'projectId'),
      taskId: optionalUuid(body.taskId, 'taskId'),
    })
    res.status(201).json({ focusSession: session })
    return
  }

  // "log": a manually-recorded, already-finished session (the legacy entry point).
  const durationMinutes = body.durationMinutes
  if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
    badRequest('"durationMinutes" must be a positive number.')
  }
  const session = await logFocusSession(sql, user.id, {
    id: optionalUuid(body.id, 'id'),
    durationMinutes,
    startedAt: optionalDateTime(body.startedAt, 'startedAt'),
    note: optionalString(body.note, 'note', { maxLength: 5_000 }),
    projectId: optionalUuid(body.projectId, 'projectId'),
    taskId: optionalUuid(body.taskId, 'taskId'),
  })
  res.status(201).json({ focusSession: session })
})
