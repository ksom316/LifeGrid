import { api, patchForJson } from '../../lib/apiClient'
import type { Project } from '../../types/domain'
import type { CreateProjectInput } from '../projects'

/**
 * Same call shape as src/data/projects.ts's projectsRepo, talking to the
 * hosted API instead of IndexedDB. AppDataContext picks this or the local
 * repo based on sign-in state (see src/state/AppDataContext.tsx) — nothing
 * else in the app needs to know which one is active.
 */
export const remoteProjectsRepo = {
  async list(): Promise<Project[]> {
    return (await api.get<{ projects: Project[] }>('/api/projects')).projects
  },
  async create(input: CreateProjectInput): Promise<Project> {
    return (await api.post<{ project: Project }>('/api/projects', input)).project
  },
  async update(id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<Project> {
    return (await api.patch<{ project: Project }>(`/api/projects/${id}`, patchForJson(patch))).project
  },
  async deletePreservingRecords(id: string): Promise<void> {
    await api.delete(`/api/projects/${id}`)
  },
}
