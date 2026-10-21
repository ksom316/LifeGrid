import { api } from '../../lib/apiClient'
import type { DailyPlan } from '../../types/domain'

export const remoteDailyPlansRepo = {
  async list(): Promise<DailyPlan[]> {
    return (await api.get<{ dailyPlans: DailyPlan[] }>('/api/daily-plans')).dailyPlans
  },
  async get(date: string): Promise<DailyPlan> {
    return (await api.get<{ dailyPlan: DailyPlan }>(`/api/daily-plans/${date}`)).dailyPlan
  },
  async addTask(date: string, taskId: string): Promise<DailyPlan> {
    return (await api.post<{ dailyPlan: DailyPlan }>(`/api/daily-plans/${date}`, { taskId })).dailyPlan
  },
  async removeTask(date: string, taskId: string): Promise<DailyPlan> {
    return (await api.delete<{ dailyPlan: DailyPlan }>(`/api/daily-plans/${date}`, { taskId })).dailyPlan
  },
}
