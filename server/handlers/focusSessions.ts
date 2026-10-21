import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthedContext } from '../http.js'
import { badRequest, notFound, readJsonBody, requireMethod } from '../http.js'
import { asRecord, optionalDateTime, optionalString, optionalUuid } from '../validation.js'
import {
  finalizeFocusSession,
  getFocusSession,
  listFocusSessions,
  logFocusSession,
  pauseFocusSession,
  removeFocusSession,
  resumeFocusSession,
  startFocusSession,
} from '../repositories/focusSessions.js'

/** Bodies moved verbatim out of the former api/focus-sessions/{index,[id],[id]/pause,[id]/resume,[id]/complete}.ts. */

export async function handleFocusSessionsIndex(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
): Promise<void> {
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
}

export async function handleFocusSessionById(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
  id: string,
): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'DELETE'])) return

  if (req.method === 'GET') {
    const session = await getFocusSession(sql, user.id, id)
    if (!session) return notFound('Focus session not found.')
    res.status(200).json({ focusSession: session })
    return
  }

  await removeFocusSession(sql, user.id, id)
  res.status(204).end()
}

export async function handleFocusSessionPause(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
  id: string,
): Promise<void> {
  if (!requireMethod(req, res, ['POST'])) return
  res.status(200).json({ focusSession: await pauseFocusSession(sql, user.id, id) })
}

export async function handleFocusSessionResume(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
  id: string,
): Promise<void> {
  if (!requireMethod(req, res, ['POST'])) return
  res.status(200).json({ focusSession: await resumeFocusSession(sql, user.id, id) })
}

export async function handleFocusSessionComplete(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
  id: string,
): Promise<void> {
  if (!requireMethod(req, res, ['POST'])) return
  const body = asRecord(readJsonBody(req), 'Request body')
  const outcome = body.outcome === 'interrupted' ? 'interrupted' : 'completed'
  res.status(200).json({ focusSession: await finalizeFocusSession(sql, user.id, id, outcome) })
}
