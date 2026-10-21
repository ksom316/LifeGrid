import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { dailyPlansRepo } from './dailyPlans'
import { createRepository } from './repository'
import type { DailyPlan } from '../types/domain'

const rawRepo = createRepository<DailyPlan>('dailyPlans')

async function clearAllPlans() {
  const plans = await dailyPlansRepo.list()
  await rawRepo.removeMany(plans.map((p) => p.id))
}

beforeEach(async () => {
  await clearAllPlans()
})

describe('dailyPlansRepo', () => {
  it('returns an empty plan for a day that has no record yet', async () => {
    const plan = await dailyPlansRepo.get('2026-01-05')
    expect(plan.taskIds).toEqual([])
  })

  it('adds a task to a day and persists it', async () => {
    await dailyPlansRepo.addTask('2026-01-05', 'task-1')
    const plan = await dailyPlansRepo.get('2026-01-05')
    expect(plan.taskIds).toEqual(['task-1'])
  })

  it('does not add the same task twice', async () => {
    await dailyPlansRepo.addTask('2026-01-05', 'task-1')
    await dailyPlansRepo.addTask('2026-01-05', 'task-1')
    const plan = await dailyPlansRepo.get('2026-01-05')
    expect(plan.taskIds).toEqual(['task-1'])
  })

  it('removes a task from a day', async () => {
    await dailyPlansRepo.addTask('2026-01-05', 'task-1')
    await dailyPlansRepo.addTask('2026-01-05', 'task-2')
    await dailyPlansRepo.removeTask('2026-01-05', 'task-1')
    const plan = await dailyPlansRepo.get('2026-01-05')
    expect(plan.taskIds).toEqual(['task-2'])
  })

  it('keeps each day independent of other days', async () => {
    await dailyPlansRepo.addTask('2026-01-05', 'task-1')
    await dailyPlansRepo.addTask('2026-01-06', 'task-2')
    const dayOne = await dailyPlansRepo.get('2026-01-05')
    const dayTwo = await dailyPlansRepo.get('2026-01-06')
    expect(dayOne.taskIds).toEqual(['task-1'])
    expect(dayTwo.taskIds).toEqual(['task-2'])
  })
})
