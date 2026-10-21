import { createRepository, nowISO } from './repository'
import type { DailyPlan } from '../types/domain'

const repo = createRepository<DailyPlan>('dailyPlans')

function emptyPlan(date: string): DailyPlan {
  const timestamp = nowISO()
  return { id: date, taskIds: [], createdAt: timestamp, updatedAt: timestamp }
}

export const dailyPlansRepo = {
  list: repo.list,

  async get(date: string): Promise<DailyPlan> {
    return (await repo.get(date)) ?? emptyPlan(date)
  },

  async addTask(date: string, taskId: string): Promise<DailyPlan> {
    const plan = await this.get(date)
    if (plan.taskIds.includes(taskId)) return plan
    const updated: DailyPlan = {
      ...plan,
      taskIds: [...plan.taskIds, taskId],
      updatedAt: nowISO(),
    }
    return repo.put(updated)
  },

  async removeTask(date: string, taskId: string): Promise<DailyPlan> {
    const plan = await this.get(date)
    const updated: DailyPlan = {
      ...plan,
      taskIds: plan.taskIds.filter((id) => id !== taskId),
      updatedAt: nowISO(),
    }
    return repo.put(updated)
  },
}
