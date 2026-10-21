import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, readJsonBody, requireMethod, withAuth } from '../../server/http.ts'
import { asRecord, optionalDate, optionalEnum, optionalString } from '../../server/validation.ts'
import { deleteProjectPreservingRecords, getProject, updateProject } from '../../server/repositories/projects.ts'
import type { ProjectColor, ProjectPriority, ProjectStatus } from '../../src/types/domain.ts'

const STATUSES: ProjectStatus[] = ['active', 'paused', 'completed', 'archived']
const PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high']
const COLORS: ProjectColor[] = ['violet', 'teal', 'amber', 'rose', 'slate']

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET', 'PATCH', 'DELETE'])) return
  const id = req.query.id
  if (typeof id !== 'string') return notFound('Project not found.')

  if (req.method === 'GET') {
    const project = await getProject(sql, user.id, id)
    if (!project) return notFound('Project not found.')
    res.status(200).json({ project })
    return
  }

  if (req.method === 'DELETE') {
    await deleteProjectPreservingRecords(sql, user.id, id)
    res.status(204).end()
    return
  }

  const body = asRecord(readJsonBody(req), 'Request body')
  const project = await updateProject(sql, user.id, id, {
    name: optionalString(body.name, 'name', { maxLength: 200 }),
    description: optionalString(body.description, 'description'),
    status: optionalEnum(body.status, 'status', STATUSES),
    priority: optionalEnum(body.priority, 'priority', PRIORITIES),
    startDate: body.startDate === null ? null : optionalDate(body.startDate, 'startDate'),
    targetDate: body.targetDate === null ? null : optionalDate(body.targetDate, 'targetDate'),
    color: optionalEnum(body.color, 'color', COLORS),
  })
  res.status(200).json({ project })
})
