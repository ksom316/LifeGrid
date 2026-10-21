import { describe, expect, it } from 'vitest'
import { computeProjectTaskStats } from './projectStats'
import type { Task } from '../types/domain'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? Math.random().toString(36),
    title: 'Task',
    notes: '',
    status: 'todo',
    priority: 'medium',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('computeProjectTaskStats', () => {
  it('returns zeroed stats for a project with no tasks', () => {
    expect(computeProjectTaskStats([])).toEqual({
      total: 0,
      completed: 0,
      remaining: 0,
      overdue: 0,
      percent: 0,
    })
  })

  it('computes counts and percent for a mix of completed and open tasks', () => {
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'todo' }),
      makeTask({ status: 'in-progress' }),
    ]
    const stats = computeProjectTaskStats(tasks)
    expect(stats.total).toBe(4)
    expect(stats.completed).toBe(2)
    expect(stats.remaining).toBe(2)
    expect(stats.percent).toBe(50)
  })

  it('counts only open tasks with a past due date as overdue', () => {
    const pastDate = '2000-01-01'
    const futureDate = '2999-01-01'
    const tasks = [
      makeTask({ status: 'todo', dueDate: pastDate }),
      makeTask({ status: 'done', dueDate: pastDate }), // completed, not overdue
      makeTask({ status: 'in-progress', dueDate: futureDate }),
      makeTask({ status: 'todo' }), // no due date
    ]
    const stats = computeProjectTaskStats(tasks)
    expect(stats.overdue).toBe(1)
  })

  it('rounds the completion percentage', () => {
    const tasks = [makeTask({ status: 'done' }), makeTask({ status: 'todo' }), makeTask({ status: 'todo' })]
    expect(computeProjectTaskStats(tasks).percent).toBe(33)
  })
})
