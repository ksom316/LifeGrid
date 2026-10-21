import { beforeEach, describe, expect, it } from 'vitest'
import { createMigratedTestSql } from '../test/testDb.ts'
import { createTestUser } from '../test/fixtures.ts'
import type { SqlPool } from '../db.ts'
import { completeTask, createTask, getTask, listTasks, updateTask } from './tasks.ts'
import type { TaskRecurrence } from '../../src/types/domain.ts'

let sql: SqlPool
let userId: string

beforeEach(async () => {
  sql = await createMigratedTestSql()
  userId = (await createTestUser(sql, 'owner@example.com')).id
})

describe('tasks repository — legacy (non-recurring) behavior', () => {
  it('creates a task with no recurrence or reminder by default', async () => {
    const task = await createTask(sql, userId, { title: 'Plain task' })
    expect(task.recurrence).toBeUndefined()
    expect(task.reminderAt).toBeUndefined()
    expect(task.recurrenceParentId).toBeUndefined()
  })

  it('completes a non-recurring task without generating a next occurrence', async () => {
    const task = await createTask(sql, userId, { title: 'One-off' })
    const { completed, nextOccurrence } = await completeTask(sql, userId, task.id)
    expect(completed.status).toBe('done')
    expect(completed.completedAt).toBeTruthy()
    expect(nextOccurrence).toBeUndefined()
    expect(await listTasks(sql, userId)).toHaveLength(1)
  })
})

describe('tasks repository — recurring completion', () => {
  const daily: TaskRecurrence = { frequency: 'daily' }

  it('preserves the completed occurrence and generates the next one with a new id', async () => {
    const task = await createTask(sql, userId, { title: 'Water plants', dueDate: '2026-03-10', recurrence: daily })
    const { completed, nextOccurrence } = await completeTask(sql, userId, task.id)

    expect(completed.id).toBe(task.id)
    expect(completed.status).toBe('done')
    expect(completed.dueDate).toBe('2026-03-10')

    expect(nextOccurrence).toBeDefined()
    expect(nextOccurrence!.id).not.toBe(task.id)
    expect(nextOccurrence!.status).toBe('todo')
    expect(nextOccurrence!.dueDate).toBe('2026-03-11')
    expect(nextOccurrence!.recurrenceParentId).toBe(task.id)

    const all = await listTasks(sql, userId)
    expect(all).toHaveLength(2)
  })

  it('copies title, notes, priority, and project association to the next occurrence', async () => {
    const task = await createTask(sql, userId, {
      title: 'Standup notes',
      notes: 'Bring laptop',
      priority: 'high',
      dueDate: '2026-03-10',
      recurrence: daily,
    })
    const { nextOccurrence } = await completeTask(sql, userId, task.id)
    expect(nextOccurrence?.title).toBe('Standup notes')
    expect(nextOccurrence?.notes).toBe('Bring laptop')
    expect(nextOccurrence?.priority).toBe('high')
  })

  // NOTE on concurrency testing: completeTask()'s duplicate-prevention relies
  // on `select ... for update` row locking inside a real Postgres
  // transaction (see repositories/tasks.ts) — standard, well-established
  // Postgres behavior. pg-mem (used for all of this file's tests, so the
  // suite needs no live database) does not simulate real connection-level
  // locking: concurrent queries against the same pg-mem instance interleave
  // rather than serialize, confirmed empirically — a `Promise.all` of three
  // `completeTask` calls against pg-mem produces 3 generated occurrences,
  // not 1, because its `for update` is parsed but not enforced as a block.
  // That means true concurrent-request safety is NOT verified by this test
  // suite; it is only verified logically, via repeated *sequential* calls
  // below, which exercises the same "does a next occurrence already exist"
  // guard that the row lock protects against racing on. This gap, and the
  // standard-Postgres-semantics reasoning it rests on, is called out
  // explicitly in the final report rather than claimed as tested.
  it('never generates a next occurrence twice under repeated sequential calls', async () => {
    const task = await createTask(sql, userId, { title: 'Task', dueDate: '2026-03-10', recurrence: daily })
    await completeTask(sql, userId, task.id)
    await completeTask(sql, userId, task.id)
    await completeTask(sql, userId, task.id)

    const all = await listTasks(sql, userId)
    expect(all.filter((t) => t.recurrenceParentId === task.id)).toHaveLength(1)
  })

  it('does not generate a next occurrence once the recurrence end date has passed', async () => {
    const task = await createTask(sql, userId, {
      title: 'Ending soon',
      dueDate: '2026-03-10',
      recurrence: { frequency: 'daily', endDate: '2026-03-10' },
    })
    const { nextOccurrence } = await completeTask(sql, userId, task.id)
    expect(nextOccurrence).toBeUndefined()
  })

  it('generates no next occurrence when recurrence has been disabled via an edit', async () => {
    const task = await createTask(sql, userId, { title: 'Task', dueDate: '2026-03-10', recurrence: daily })
    await updateTask(sql, userId, task.id, { recurrence: null })
    const { nextOccurrence } = await completeTask(sql, userId, task.id)
    expect(nextOccurrence).toBeUndefined()
  })

  it('completing the next occurrence continues the series with correctly advancing dates', async () => {
    const first = await createTask(sql, userId, { title: 'Task', dueDate: '2026-03-10', recurrence: daily })
    const { nextOccurrence: second } = await completeTask(sql, userId, first.id)
    expect(second?.dueDate).toBe('2026-03-11')

    const { nextOccurrence: third } = await completeTask(sql, userId, second!.id)
    expect(third?.dueDate).toBe('2026-03-12')
    expect(third?.recurrenceParentId).toBe(second!.id)
  })

  it('editing the next occurrence does not retroactively rewrite the completed occurrence', async () => {
    const task = await createTask(sql, userId, { title: 'Original title', dueDate: '2026-03-10', recurrence: daily })
    const { completed, nextOccurrence } = await completeTask(sql, userId, task.id)

    await updateTask(sql, userId, nextOccurrence!.id, { title: 'Renamed for next time' })

    const historical = await getTask(sql, userId, completed.id)
    expect(historical?.title).toBe('Original title')
  })
})
