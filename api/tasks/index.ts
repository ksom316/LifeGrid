import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readJsonBody, requireMethod, withAuth } from '../../server/http.js'
import {
  asRecord,
  optionalDate,
  optionalDateTime,
  optionalEnum,
  optionalRecurrence,
  optionalString,
  optionalUuid,
  requireString,
} from '../../server/validation.js'
import { createTask, listTasks } from '../../server/repositories/tasks.js'
import type { TaskPriority, TaskStatus } from '../../src/types/domain.js'

const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done']
const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET', 'POST'])) return

  if (req.method === 'GET') {
    res.status(200).json({ tasks: await listTasks(sql, user.id) })
    return
  }

  const body = asRecord(readJsonBody(req), 'Request body')
  const task = await createTask(sql, user.id, {
    id: optionalUuid(body.id, 'id'),
    title: requireString(body.title, 'title', { maxLength: 300 }),
    notes: optionalString(body.notes, 'notes'),
    projectId: optionalUuid(body.projectId, 'projectId'),
    status: optionalEnum(body.status, 'status', STATUSES),
    priority: optionalEnum(body.priority, 'priority', PRIORITIES),
    dueDate: optionalDate(body.dueDate, 'dueDate'),
    recurrence: optionalRecurrence(body.recurrence, 'recurrence'),
    reminderAt: optionalDateTime(body.reminderAt, 'reminderAt'),
  })
  res.status(201).json({ task })
})
