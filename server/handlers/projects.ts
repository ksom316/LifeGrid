import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthedContext } from '../http.js'
import { notFound, readJsonBody, requireMethod } from '../http.js'
import { asRecord, optionalDate, optionalEnum, optionalString, optionalUuid, requireString } from '../validation.js'
import { createProject, deleteProjectPreservingRecords, getProject, listProjects, updateProject } from '../repositories/projects.js'
import { PALETTE_COLORS } from '../../src/utils/colors.js'
import type { ProjectColor, ProjectPriority, ProjectStatus } from '../../src/types/domain.js'

const STATUSES: ProjectStatus[] = ['active', 'paused', 'completed', 'archived']
const PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high']
const COLORS = PALETTE_COLORS

/**
 * '' is a valid, meaningful value here — it's how a client asks to reset a
 * project back to its automatic, id-derived colour (see Project.color's
 * doc comment in src/types/domain.ts) — so it has to be accepted
 * separately from optionalEnum, which would otherwise reject it as not one
 * of the palette values.
 */
function optionalColorOrAuto(value: unknown, field: string): ProjectColor | '' | undefined {
  if (value === '') return ''
  return optionalEnum(value, field, COLORS)
}

/** Bodies moved verbatim out of the former api/projects/{index,[id]}.ts. */

export async function handleProjectsIndex(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
): Promise<void> {
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
    color: optionalColorOrAuto(body.color, 'color'),
  })
  res.status(201).json({ project })
}

export async function handleProjectById(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
  id: string,
): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'PATCH', 'DELETE'])) return

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
    color: optionalColorOrAuto(body.color, 'color'),
  })
  res.status(200).json({ project })
}
