import { createId, createRepository, nowISO } from './repository'
import { focusSessionsRepo } from './focusSessions'
import { notesRepo } from './notes'
import { tasksRepo } from './tasks'
import type { Project, ProjectColor, ProjectPriority, ProjectStatus } from '../types/domain'

const repo = createRepository<Project>('projects')

export interface CreateProjectInput {
  name: string
  description?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  startDate?: string
  targetDate?: string
  color?: ProjectColor
  isDemo?: boolean
}

/** Reads a project's priority, defaulting to 'medium' for records created before the field existed. */
export function projectPriority(project: Project): ProjectPriority {
  return project.priority ?? 'medium'
}

export const projectsRepo = {
  list: repo.list,
  get: repo.get,
  remove: repo.remove,
  removeMany: repo.removeMany,

  async create(input: CreateProjectInput): Promise<Project> {
    const timestamp = nowISO()
    const project: Project = {
      id: createId(),
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      status: input.status ?? 'active',
      priority: input.priority ?? 'medium',
      startDate: input.startDate,
      targetDate: input.targetDate,
      color: input.color ?? 'violet',
      createdAt: timestamp,
      updatedAt: timestamp,
      isDemo: input.isDemo,
    }
    return repo.put(project)
  },

  async update(id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<Project> {
    const existing = await repo.get(id)
    if (!existing) throw new Error(`Project ${id} not found`)
    const updated: Project = { ...existing, ...patch, updatedAt: nowISO() }
    return repo.put(updated)
  },

  /**
   * Deletes a project without orphaning or deleting its records: tasks,
   * notes, and focus sessions that reference it are unassigned (projectId
   * cleared) first, then the project itself is removed.
   */
  async deletePreservingRecords(id: string): Promise<void> {
    const [tasks, notes, sessions] = await Promise.all([
      tasksRepo.list(),
      notesRepo.list(),
      focusSessionsRepo.list(),
    ])

    await Promise.all([
      ...tasks
        .filter((t) => t.projectId === id)
        .map((t) => tasksRepo.update(t.id, { projectId: undefined })),
      ...notes
        .filter((n) => n.projectId === id)
        .map((n) => notesRepo.update(n.id, { projectId: undefined })),
      ...sessions
        .filter((s) => s.projectId === id)
        .map((s) => focusSessionsRepo.update(s.id, { projectId: undefined })),
    ])

    await repo.remove(id)
  },
}
