import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { dailyPlansRepo } from '../../data/dailyPlans'
import { focusSessionsRepo } from '../../data/focusSessions'
import { notesRepo } from '../../data/notes'
import { projectsRepo } from '../../data/projects'
import { tasksRepo } from '../../data/tasks'
import { weeklyReviewsRepo } from '../../data/weeklyReviews'
import { renderFocusApp } from '../../test/testUtils'
import { createRepository } from '../../data/repository'
import type { DailyPlan, WeeklyReview } from '../../types/domain'

const dailyPlanRawRepo = createRepository<DailyPlan>('dailyPlans')
const weeklyReviewRawRepo = createRepository<WeeklyReview>('weeklyReviews')

async function clearAllRecords() {
  const [projects, tasks, notes, sessions, plans, reviews] = await Promise.all([
    projectsRepo.list(),
    tasksRepo.list(),
    notesRepo.list(),
    focusSessionsRepo.list(),
    dailyPlansRepo.list(),
    weeklyReviewsRepo.list(),
  ])
  await Promise.all([
    projectsRepo.removeMany(projects.map((p) => p.id)),
    tasksRepo.removeMany(tasks.map((t) => t.id)),
    notesRepo.removeMany(notes.map((n) => n.id)),
    focusSessionsRepo.removeMany(sessions.map((s) => s.id)),
    dailyPlanRawRepo.removeMany(plans.map((p) => p.id)),
    weeklyReviewRawRepo.removeMany(reviews.map((r) => r.id)),
  ])
}

beforeEach(async () => {
  await clearAllRecords()
})

afterEach(async () => {
  await clearAllRecords()
})

describe('FocusTab — timer', () => {
  it('starts a focus session from the config form', async () => {
    renderFocusApp('/focus')
    await screen.findByRole('button', { name: /^start focus$/i })

    fireEvent.click(screen.getByRole('button', { name: /^start focus$/i }))

    await waitFor(async () => {
      const sessions = await focusSessionsRepo.list()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].status).toBe('active')
      expect(sessions[0].type).toBe('focus')
    })
    expect(await screen.findByRole('timer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })

  it('pauses and resumes a running session, persisting status changes', async () => {
    renderFocusApp('/focus')
    await screen.findByRole('button', { name: /^start focus$/i })
    fireEvent.click(screen.getByRole('button', { name: /^start focus$/i }))
    await screen.findByRole('button', { name: /pause/i })

    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    await waitFor(async () => {
      const sessions = await focusSessionsRepo.list()
      expect(sessions[0].status).toBe('paused')
    })
    expect(await screen.findByText('Paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    await waitFor(async () => {
      const sessions = await focusSessionsRepo.list()
      expect(sessions[0].status).toBe('active')
    })
    expect(await screen.findByRole('button', { name: /pause/i })).toBeInTheDocument()
  })

  it('ends a session early after confirmation, recording it as interrupted', async () => {
    renderFocusApp('/focus')
    await screen.findByRole('button', { name: /^start focus$/i })
    fireEvent.click(screen.getByRole('button', { name: /^start focus$/i }))
    await screen.findByRole('button', { name: /pause/i })

    fireEvent.click(screen.getByRole('button', { name: /^end$/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /end session/i }))

    await waitFor(async () => {
      const sessions = await focusSessionsRepo.list()
      expect(sessions[0].status).toBe('interrupted')
    })
    expect(await screen.findByText(/ended early/i)).toBeInTheDocument()
    // The form returns so another session can be started.
    expect(screen.getByRole('button', { name: /^start focus$/i })).toBeInTheDocument()
  })

  it('completes a session exactly once when it has already reached its planned duration', async () => {
    const session = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    // Backdate resumedAt so the session is already past its planned duration —
    // no real waiting required to exercise the completion path.
    await focusSessionsRepo.update(session.id, {
      resumedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    })

    renderFocusApp('/focus')

    expect(await screen.findByText(/session complete/i)).toBeInTheDocument()

    const sessions = await focusSessionsRepo.list()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].status).toBe('completed')
    expect(sessions[0].durationMinutes).toBeGreaterThanOrEqual(25)
  })

  it('recovers an active session after a remount (simulating a page refresh)', async () => {
    await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })

    renderFocusApp('/focus')

    expect(await screen.findByRole('timer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^start focus$/i })).not.toBeInTheDocument()
  })

  it('recovers a paused session after a remount, keeping the frozen elapsed time', async () => {
    const session = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    await focusSessionsRepo.pause(session.id)

    renderFocusApp('/focus')

    expect(await screen.findByText('Paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
  })
})

describe('FocusTab — daily planning', () => {
  it('adds a task to today\'s priorities and persists it', async () => {
    await tasksRepo.create({ title: 'Write the report' })

    renderFocusApp('/focus')
    await screen.findByText('No priorities picked for today')

    fireEvent.change(screen.getByLabelText('Add a priority'), {
      target: { value: (await tasksRepo.list())[0].id },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(await screen.findByText('Write the report', { selector: 'span' })).toBeInTheDocument()
    const today = new Date().toISOString().slice(0, 10)
    const plan = await dailyPlansRepo.get(today)
    expect(plan.taskIds).toHaveLength(1)
  })

  it('removes a task from today\'s priorities and persists it', async () => {
    const task = await tasksRepo.create({ title: 'Write the report' })
    const today = new Date().toISOString().slice(0, 10)
    await dailyPlansRepo.addTask(today, task.id)

    renderFocusApp('/focus')
    await screen.findByText('Write the report', { selector: 'span' })

    fireEvent.click(screen.getByRole('button', { name: /remove "write the report"/i }))

    await waitFor(() => expect(screen.queryByText('Write the report', { selector: 'span' })).not.toBeInTheDocument())
    const plan = await dailyPlansRepo.get(today)
    expect(plan.taskIds).toHaveLength(0)
  })

  it('marks a daily priority complete through the existing task mutation API', async () => {
    const task = await tasksRepo.create({ title: 'Write the report' })
    const today = new Date().toISOString().slice(0, 10)
    await dailyPlansRepo.addTask(today, task.id)

    renderFocusApp('/focus')
    await screen.findByText('Write the report', { selector: 'span' })

    fireEvent.click(screen.getByRole('button', { name: /mark "write the report" as done/i }))

    await waitFor(async () => {
      const updated = await tasksRepo.get(task.id)
      expect(updated?.status).toBe('done')
    })
  })

  it('visibly reflects completion in the priority list instead of leaving the row unchanged', async () => {
    // Regression test: completing a daily priority used to leave its row
    // pixel-identical (no strikethrough, no filled checkbox, same label),
    // unlike the Dashboard's priorities card, which removes a task from view
    // on completion — so a user had no feedback their click registered.
    const task = await tasksRepo.create({ title: 'Write the report' })
    const today = new Date().toISOString().slice(0, 10)
    await dailyPlansRepo.addTask(today, task.id)

    renderFocusApp('/focus')
    const toggle = await screen.findByRole('button', { name: /mark "write the report" as done/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)

    const doneToggle = await screen.findByRole('button', { name: /mark "write the report" as not done/i })
    expect(doneToggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Write the report', { selector: 'span' })).toHaveClass('line-through')
    // The task must still be visible in the list (not silently dropped) so
    // the day's full picture — done and not-done — stays reviewable.
    expect(screen.getByText('Write the report', { selector: 'span' })).toBeInTheDocument()
  })
})

describe('FocusTab — planning sections (overdue / due today / upcoming)', () => {
  function dateOffset(days: number): string {
    // Mirrors the app's own local-date convention (utils/date.ts), not
    // toISOString(), which is UTC and can land on the wrong local day.
    const d = new Date()
    d.setDate(d.getDate() + days)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  it('shows no planning sections when there are no open tasks with due dates', async () => {
    renderFocusApp('/focus')
    await screen.findByText('No priorities picked for today')
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
    expect(screen.queryByText('Due today')).not.toBeInTheDocument()
    expect(screen.queryByText('Upcoming')).not.toBeInTheDocument()
  })

  it('places each open task into exactly one of overdue, due today, or upcoming', async () => {
    await tasksRepo.create({ title: 'Late invoice', dueDate: dateOffset(-3) })
    await tasksRepo.create({ title: 'Call the dentist', dueDate: dateOffset(0) })
    await tasksRepo.create({ title: 'Plan the trip', dueDate: dateOffset(10) })
    await tasksRepo.create({ title: 'Already finished', dueDate: dateOffset(-5), status: 'done' })

    renderFocusApp('/focus')

    expect(await screen.findByText('Overdue', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Due today', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Upcoming', { selector: 'p' })).toBeInTheDocument()

    expect(screen.getByText('Late invoice', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Call the dentist', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Plan the trip', { selector: 'span' })).toBeInTheDocument()
    // A completed task never appears in any planning bucket (it also has no
    // unrelated select-option elsewhere, since done tasks aren't pickable there either).
    expect(screen.queryByText('Already finished')).not.toBeInTheDocument()

    // Each task renders exactly once as a planning-section row — never duplicated across sections.
    expect(screen.getAllByText('Late invoice', { selector: 'span' })).toHaveLength(1)
    expect(screen.getAllByText('Call the dentist', { selector: 'span' })).toHaveLength(1)
    expect(screen.getAllByText('Plan the trip', { selector: 'span' })).toHaveLength(1)
  })

  it('excludes a task from the planning sections once it has been picked as a priority', async () => {
    const task = await tasksRepo.create({ title: 'Overdue but prioritized', dueDate: dateOffset(-1) })
    const today = new Date().toISOString().slice(0, 10)
    await dailyPlansRepo.addTask(today, task.id)

    renderFocusApp('/focus')

    await screen.findByText('Overdue but prioritized', { selector: 'span' })
    // It must not also appear a second time inside the Overdue section.
    expect(screen.getAllByText('Overdue but prioritized', { selector: 'span' })).toHaveLength(1)
    expect(screen.queryByText('Overdue', { selector: 'p' })).not.toBeInTheDocument()
  })

  it('lets a planning-section task be added directly to today\'s priorities', async () => {
    await tasksRepo.create({ title: 'Renew passport', dueDate: dateOffset(2) })

    renderFocusApp('/focus')
    await screen.findByText('Renew passport', { selector: 'span' })

    fireEvent.click(screen.getByRole('button', { name: /add "renew passport" to today's priorities/i }))

    await waitFor(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const plan = await dailyPlansRepo.get(today)
      expect(plan.taskIds).toHaveLength(1)
    })
    // Having been promoted to a priority, it drops out of the Upcoming section.
    await waitFor(() => expect(screen.queryByText('Upcoming', { selector: 'p' })).not.toBeInTheDocument())
  })

  it('links a planning-section task with a project to that project, and renders gracefully without one', async () => {
    const project = await projectsRepo.create({ name: 'Home renovation' })
    const linkedTask = await tasksRepo.create({
      title: 'Buy paint',
      projectId: project.id,
      dueDate: dateOffset(1),
    })
    await tasksRepo.create({ title: 'Unassociated errand', dueDate: dateOffset(1) })

    renderFocusApp('/focus')
    const link = await screen.findByRole('link', { name: 'Buy paint' })
    expect(link).toHaveAttribute('href', `/projects/${project.id}?task=${linkedTask.id}`)

    // A task with no project renders as plain text, not a broken link.
    expect(screen.getByText('Unassociated errand', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Unassociated errand' })).not.toBeInTheDocument()
  })
})
