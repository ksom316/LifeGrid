import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readJsonBody, requireMethod, withAuth } from '../../server/http.js'
import { asRecord, optionalDate, optionalEnum, optionalString, optionalUuid, requireString } from '../../server/validation.js'
import { createProject, listProjects } from '../../server/repositories/projects.js'
import type { ProjectColor, ProjectPriority, ProjectStatus } from '../../src/types/domain.js'

const STATUSES: ProjectStatus[] = ['active', 'paused', 'completed', 'archived']
const PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high']
const COLORS: ProjectColor[] = ['violet', 'teal', 'amber', 'rose', 'slate']

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET', 'POST'])) return

  if (req.method === 'GET') {
    res.status(200).json({ projects: await listProjects(sql, user.id) })
    return
  }

  const body = asRecord(readJsonBody(req), 'Request body')
  const project = await createProject(sql, user.id, {
    id: optionalUuid(body.id, 'id'),
    name: requireString(body.name, 'name', { maxLength: 200 }),
    description: optionalString(body.description, 'description'),
    status: optionalEnum(body.status, 'status', STATUSES),
    priority: optionalEnum(body.priority, 'priority', PRIORITIES),
    startDate: optionalDate(body.startDate, 'startDate'),
    targetDate: optionalDate(body.targetDate, 'targetDate'),
    color: optionalEnum(body.color, 'color', COLORS),
  })
  res.status(201).json({ project })
})
