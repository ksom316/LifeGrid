import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, readJsonBody, requireMethod, withAuth } from '../../server/http.ts'
import {
  asRecord,
  optionalDate,
  optionalDateTime,
  optionalEnum,
  optionalRecurrence,
  optionalString,
  optionalUuid,
} from '../../server/validation.ts'
import { getTask, removeTask, updateTask } from '../../server/repositories/tasks.ts'
import type { TaskPriority, TaskStatus } from '../../src/types/domain.ts'

const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done']
const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET', 'PATCH', 'DELETE'])) return
  const id = req.query.id
  if (typeof id !== 'string') return notFound('Task not found.')

  if (req.method === 'GET') {
    const task = await getTask(sql, user.id, id)
    if (!task) return notFound('Task not found.')
    res.status(200).json({ task })
    return
  }

  if (req.method === 'DELETE') {
    await removeTask(sql, user.id, id)
    res.status(204).end()
    return
  }

  const body = asRecord(readJsonBody(req), 'Request body')
  const task = await updateTask(sql, user.id, id, {
    title: optionalString(body.title, 'title', { maxLength: 300 }),
    notes: optionalString(body.notes, 'notes'),
    projectId: body.projectId === null ? null : optionalUuid(body.projectId, 'projectId'),
    status: optionalEnum(body.status, 'status', STATUSES),
    priority: optionalEnum(body.priority, 'priority', PRIORITIES),
    dueDate: body.dueDate === null ? null : optionalDate(body.dueDate, 'dueDate'),
    completedAt: body.completedAt === null ? null : optionalDateTime(body.completedAt, 'completedAt'),
    recurrence: body.recurrence === null ? null : optionalRecurrence(body.recurrence, 'recurrence'),
    reminderAt: body.reminderAt === null ? null : optionalDateTime(body.reminderAt, 'reminderAt'),
  })
  res.status(200).json({ task })
})
