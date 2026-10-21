import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthedContext } from '../http.js'
import { notFound, readJsonBody, requireMethod } from '../http.js'
import {
  asRecord,
  optionalDate,
  optionalDateTime,
  optionalEnum,
  optionalRecurrence,
  optionalString,
  optionalUuid,
  requireString,
} from '../validation.js'
import { completeTask, createTask, getTask, listTasks, removeTask, updateTask } from '../repositories/tasks.js'
import type { TaskPriority, TaskStatus } from '../../src/types/domain.js'

const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done']
const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']

/** Bodies moved verbatim out of the former api/tasks/{index,[id],[id]/complete}.ts. */

export async function handleTasksIndex(req: VercelRequest, res: VercelResponse, { sql, user }: AuthedContext): Promise<void> {
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
}

export async function handleTaskById(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
  id: string,
): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'PATCH', 'DELETE'])) return

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
}

export async function handleTaskComplete(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
  id: string,
): Promise<void> {
  if (!requireMethod(req, res, ['POST'])) return
  const result = await completeTask(sql, user.id, id)
  res.status(200).json(result)
}
