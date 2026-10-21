import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { tasksRepo } from './tasks'
import { clearDemoData, seedDemoData } from './demoData'
import type { TaskRecurrence } from '../types/domain'

async function clearAllTasks() {
  const tasks = await tasksRepo.list()
  await tasksRepo.removeMany(tasks.map((t) => t.id))
}

beforeEach(async () => {
  await clearAllTasks()
})

describe('tasksRepo — legacy (non-recurring) behavior', () => {
  it('creates a task with no recurrence or reminder by default', async () => {
    const task = await tasksRepo.create({ title: 'Plain task' })
    expect(task.recurrence).toBeUndefined()
    expect(task.reminderAt).toBeUndefined()
    expect(task.recurrenceParentId).toBeUndefined()
  })

  it('completes a non-recurring task without generating any next occurrence', async () => {
    const task = await tasksRepo.create({ title: 'One-off task' })
    const { completed, nextOccurrence } = await tasksRepo.completeTask(task.id)
    expect(completed.status).toBe('done')
    expect(completed.completedAt).toBeTruthy()
    expect(nextOccurrence).toBeUndefined()
    expect(await tasksRepo.list()).toHaveLength(1)
  })

  it('toggleDone still works exactly as before for a non-recurring task', async () => {
    const task = await tasksRepo.create({ title: 'Toggle me' })
    const done = await tasksRepo.toggleDone(task.id)
    expect(done.status).toBe('done')
    const reopened = await tasksRepo.toggleDone(task.id)
    expect(reopened.status).toBe('todo')
    expect(reopened.completedAt).toBeUndefined()
  })
})

describe('tasksRepo — recurring task completion', () => {
  const daily: TaskRecurrence = { frequency: 'daily' }

  it('preserves the completed occurrence and generates the next one with a new ID', async () => {
    const task = await tasksRepo.create({ title: 'Water plants', dueDate: '2026-03-10', recurrence: daily })
    const { completed, nextOccurrence } = await tasksRepo.completeTask(task.id)

    expect(completed.id).toBe(task.id)
    expect(completed.status).toBe('done')
    expect(completed.completedAt).toBeTruthy()
    expect(completed.dueDate).toBe('2026-03-10') // history: original due date untouched

    expect(nextOccurrence).toBeDefined()
    expect(nextOccurrence!.id).not.toBe(task.id)
    expect(nextOccurrence!.status).toBe('todo')
    expect(nextOccurrence!.dueDate).toBe('2026-03-11')
    expect(nextOccurrence!.recurrenceParentId).toBe(task.id)

    // Both records genuinely exist — history is preserved, not mutated in place.
    const all = await tasksRepo.list()
    expect(all).toHaveLength(2)
    expect(all.find((t) => t.id === task.id)?.status).toBe('done')
  })

  it('copies title, notes, priority, and project association to the next occurrence', async () => {
    const task = await tasksRepo.create({
      title: 'Weekly standup notes',
      notes: 'Bring laptop',
      priority: 'high',
      projectId: 'project-1',
      dueDate: '2026-03-10',
      recurrence: daily,
    })
    const { nextOccurrence } = await tasksRepo.completeTask(task.id)
    expect(nextOccurrence?.title).toBe('Weekly standup notes')
    expect(nextOccurrence?.notes).toBe('Bring laptop')
    expect(nextOccurrence?.priority).toBe('high')
    expect(nextOccurrence?.projectId).toBe('project-1')
  })

  it('does not copy completion-specific metadata to the next occurrence', async () => {
    const task = await tasksRepo.create({ title: 'Task', dueDate: '2026-03-10', recurrence: daily })
    const { nextOccurrence } = await tasksRepo.completeTask(task.id)
    expect(nextOccurrence?.completedAt).toBeUndefined()
    expect(nextOccurrence?.status).toBe('todo')
  })

  it('never generates a next occurrence twice for the same completion, even when called repeatedly', async () => {
    const task = await tasksRepo.create({ title: 'Task', dueDate: '2026-03-10', recurrence: daily })
    await tasksRepo.completeTask(task.id)
    await tasksRepo.completeTask(task.id)
    await tasksRepo.completeTask(task.id)

    const all = await tasksRepo.list()
    const generated = all.filter((t) => t.recurrenceParentId === task.id)
    expect(generated).toHaveLength(1)
  })

  it('never generates duplicate next occurrences under concurrent completion calls', async () => {
    const task = await tasksRepo.create({ title: 'Task', dueDate: '2026-03-10', recurrence: daily })
    const results = await Promise.all([
      tasksRepo.completeTask(task.id),
      tasksRepo.completeTask(task.id),
      tasksRepo.completeTask(task.id),
    ])

    const generatedCount = results.filter((r) => r.nextOccurrence).length
    expect(generatedCount).toBe(1) // exactly one caller actually generated it

    const all = await tasksRepo.list()
    expect(all.filter((t) => t.recurrenceParentId === task.id)).toHaveLength(1)
  })

  it('reopening a completed recurring task does not remove or duplicate its next occurrence', async () => {
    const task = await tasksRepo.create({ title: 'Task', dueDate: '2026-03-10', recurrence: daily })
    await tasksRepo.completeTask(task.id)
    await tasksRepo.toggleDone(task.id) // reopen

    const all = await tasksRepo.list()
    expect(all).toHaveLength(2)
    expect(all.find((t) => t.id === task.id)?.status).toBe('todo')
    expect(all.filter((t) => t.recurrenceParentId === task.id)).toHaveLength(1)
  })

  it('does not generate a next occurrence when recurrence has no due date to anchor from', async () => {
    const task = await tasksRepo.create({ title: 'No due date', recurrence: daily })
    const { nextOccurrence } = await tasksRepo.completeTask(task.id)
    expect(nextOccurrence).toBeUndefined()
  })

  it('does not generate a next occurrence once the recurrence end date has passed', async () => {
    const task = await tasksRepo.create({
      title: 'Ending soon',
      dueDate: '2026-03-10',
      recurrence: { frequency: 'daily', endDate: '2026-03-10' },
    })
    const { nextOccurrence } = await tasksRepo.completeTask(task.id)
    expect(nextOccurrence).toBeUndefined()
  })

  it('generates no next occurrence when recurrence has been disabled via an edit', async () => {
    const task = await tasksRepo.create({ title: 'Task', dueDate: '2026-03-10', recurrence: daily })
    await tasksRepo.update(task.id, { recurrence: undefined })
    const { nextOccurrence } = await tasksRepo.completeTask(task.id)
    expect(nextOccurrence).toBeUndefined()
  })

  it('completing the next occurrence continues the series with correctly advancing dates', async () => {
    const first = await tasksRepo.create({ title: 'Task', dueDate: '2026-03-10', recurrence: daily })
    const { nextOccurrence: second } = await tasksRepo.completeTask(first.id)
    expect(second?.dueDate).toBe('2026-03-11')

    const { nextOccurrence: third } = await tasksRepo.completeTask(second!.id)
    expect(third?.dueDate).toBe('2026-03-12')
    expect(third?.recurrenceParentId).toBe(second!.id)
  })
})

describe('tasksRepo — editing current occurrence vs. history', () => {
  it('editing the current occurrence’s recurrence rule does not touch an already-completed occurrence', async () => {
    const task = await tasksRepo.create({
      title: 'Task',
      dueDate: '2026-03-10',
      recurrence: { frequency: 'daily' },
    })
    const { completed, nextOccurrence } = await tasksRepo.completeTask(task.id)

    // Change the *next* occurrence's recurrence rule to weekly.
    await tasksRepo.update(nextOccurrence!.id, { recurrence: { frequency: 'weekly', weekdays: [1] } })

    const historicalRecord = await tasksRepo.get(completed.id)
    expect(historicalRecord?.recurrence?.frequency).toBe('daily') // untouched
  })

  it('editing the next occurrence’s title does not retroactively rewrite the completed occurrence’s title', async () => {
    const task = await tasksRepo.create({
      title: 'Original title',
      dueDate: '2026-03-10',
      recurrence: { frequency: 'daily' },
    })
    const { completed, nextOccurrence } = await tasksRepo.completeTask(task.id)
    expect(completed.title).toBe('Original title')

    // Editing the new, still-open occurrence is a completely separate record.
    await tasksRepo.update(nextOccurrence!.id, { title: 'Renamed for next time' })

    const historicalRecord = await tasksRepo.get(completed.id)
    expect(historicalRecord?.title).toBe('Original title')
    const updatedNext = await tasksRepo.get(nextOccurrence!.id)
    expect(updatedNext?.title).toBe('Renamed for next time')
  })
})

describe('tasksRepo — demo data isolation', () => {
  it('removing demo data never deletes real tasks, recurring or not', async () => {
    const real = await tasksRepo.create({ title: 'Real recurring task', dueDate: '2026-03-10', recurrence: { frequency: 'daily' } })
    await seedDemoData()

    await clearDemoData()

    const remaining = await tasksRepo.list()
    expect(remaining.map((t) => t.id)).toContain(real.id)
    expect(remaining.every((t) => !t.isDemo)).toBe(true)
  })
})
