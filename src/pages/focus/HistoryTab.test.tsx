import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { focusSessionsRepo } from '../../data/focusSessions'
import { notesRepo } from '../../data/notes'
import { projectsRepo } from '../../data/projects'
import { tasksRepo } from '../../data/tasks'
import { renderFocusApp } from '../../test/testUtils'

async function clearAllRecords() {
  const [projects, tasks, notes, sessions] = await Promise.all([
    projectsRepo.list(),
    tasksRepo.list(),
    notesRepo.list(),
    focusSessionsRepo.list(),
  ])
  await Promise.all([
    projectsRepo.removeMany(projects.map((p) => p.id)),
    tasksRepo.removeMany(tasks.map((t) => t.id)),
    notesRepo.removeMany(notes.map((n) => n.id)),
    focusSessionsRepo.removeMany(sessions.map((s) => s.id)),
  ])
}

beforeEach(async () => {
  await clearAllRecords()
})

afterEach(async () => {
  await clearAllRecords()
})

describe('HistoryTab', () => {
  it('shows an empty state when there are no sessions', async () => {
    renderFocusApp('/focus/history')
    expect(await screen.findByText('No focus sessions yet')).toBeInTheDocument()
  })

  it('renders completed and interrupted sessions, distinguishing their status', async () => {
    const completed = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    await focusSessionsRepo.update(completed.id, {
      resumedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
    })
    await focusSessionsRepo.complete(completed.id)

    const interrupted = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    await focusSessionsRepo.update(interrupted.id, {
      resumedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    })
    await focusSessionsRepo.endEarly(interrupted.id)

    renderFocusApp('/focus/history')

    expect(await screen.findByText('completed')).toBeInTheDocument()
    expect(screen.getByText('interrupted')).toBeInTheDocument()
  })

  it('excludes an in-progress session from history entirely', async () => {
    await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })

    renderFocusApp('/focus/history')

    expect(await screen.findByText('No focus sessions yet')).toBeInTheDocument()
  })

  it('filters session history by project', async () => {
    const projectA = await projectsRepo.create({ name: 'Alpha project' })
    const projectB = await projectsRepo.create({ name: 'Beta project' })

    const sessionA = await focusSessionsRepo.start({
      type: 'focus',
      plannedDurationMinutes: 25,
      projectId: projectA.id,
    })
    await focusSessionsRepo.complete(sessionA.id)
    const sessionB = await focusSessionsRepo.start({
      type: 'focus',
      plannedDurationMinutes: 25,
      projectId: projectB.id,
    })
    await focusSessionsRepo.complete(sessionB.id)

    renderFocusApp('/focus/history')
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))

    fireEvent.change(screen.getByLabelText('Filter sessions by project'), {
      target: { value: projectA.id },
    })

    await waitFor(() => {
      const items = screen.getAllByRole('listitem')
      expect(items).toHaveLength(1)
      expect(items[0]).toHaveTextContent('Alpha project')
    })
  })

  it('filters session history by date range', async () => {
    const recent = await focusSessionsRepo.create({
      durationMinutes: 25,
      startedAt: new Date().toISOString(),
    })
    const old = await focusSessionsRepo.create({
      durationMinutes: 25,
      startedAt: new Date('2020-01-01T09:00:00.000Z').toISOString(),
    })
    void recent
    void old

    renderFocusApp('/focus/history')
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))

    const todayKey = new Date().toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText('Filter sessions from date'), {
      target: { value: todayKey },
    })

    await waitFor(() => {
      expect(screen.getAllByText('25 min')).toHaveLength(1)
    })
  })

  it('shows a graceful fallback when a session’s project has been deleted', async () => {
    const project = await projectsRepo.create({ name: 'Temporary project' })
    const session = await focusSessionsRepo.start({
      type: 'focus',
      plannedDurationMinutes: 25,
      projectId: project.id,
    })
    await focusSessionsRepo.complete(session.id)
    await projectsRepo.deletePreservingRecords(project.id)

    renderFocusApp('/focus/history')

    expect(await screen.findByText('completed')).toBeInTheDocument()
    expect(screen.queryByText('Temporary project')).not.toBeInTheDocument()
  })

  it('computes today and week stats from completed focus sessions only', async () => {
    const focusSession = await focusSessionsRepo.start({ type: 'focus', plannedDurationMinutes: 25 })
    await focusSessionsRepo.update(focusSession.id, {
      resumedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
    })
    await focusSessionsRepo.complete(focusSession.id)

    const breakSession = await focusSessionsRepo.start({ type: 'short-break', plannedDurationMinutes: 5 })
    await focusSessionsRepo.update(breakSession.id, {
      resumedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    })
    await focusSessionsRepo.complete(breakSession.id)

    renderFocusApp('/focus/history')

    // Today, this-week, and average all equal 25m here since there's a single
    // completed focus session — the break session must not inflate any of them.
    expect(await screen.findAllByText('25m')).toHaveLength(3)
    expect(screen.getByText('1', { selector: 'p' })).toBeInTheDocument()
  })
})
