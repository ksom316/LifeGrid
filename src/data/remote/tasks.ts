import { api, patchForJson } from '../../lib/apiClient'
import type { Task } from '../../types/domain'
import type { CompleteTaskResult, CreateTaskInput } from '../tasks'

/** Same call shape as src/data/tasks.ts's tasksRepo, talking to the hosted API instead of IndexedDB. */
export const remoteTasksRepo = {
  async list(): Promise<Task[]> {
    return (await api.get<{ tasks: Task[] }>('/api/tasks')).tasks
  },
  async create(input: CreateTaskInput): Promise<Task> {
    return (await api.post<{ task: Task }>('/api/tasks', input)).task
  },
  async update(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task> {
    return (await api.patch<{ task: Task }>(`/api/tasks/${id}`, patchForJson(patch))).task
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/api/tasks/${id}`)
  },
  async completeTask(id: string): Promise<CompleteTaskResult> {
    return api.post<CompleteTaskResult>(`/api/tasks/${id}/complete`)
  },
  async toggleDone(id: string): Promise<Task> {
    // Mirrors the local repo's toggleDone: reopen if done, otherwise route
    // through the recurrence-aware completion endpoint.
    const tasks = await this.list()
    const existing = tasks.find((t) => t.id === id)
    if (existing?.status === 'done') {
      return this.update(id, { status: 'todo', completedAt: undefined })
    }
    const { completed } = await this.completeTask(id)
    return completed
  },
}
