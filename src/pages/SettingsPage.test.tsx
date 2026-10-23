import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { createBackup } from '../data/backup'
import { dailyPlansRepo } from '../data/dailyPlans'
import { focusSessionsRepo } from '../data/focusSessions'
import { notesRepo } from '../data/notes'
import { projectsRepo } from '../data/projects'
import { tasksRepo } from '../data/tasks'
import { weeklyReviewsRepo } from '../data/weeklyReviews'
import { createRepository } from '../data/repository'
import { renderWithProviders } from '../test/testUtils'
import { SettingsPage } from './SettingsPage'
import type { DailyPlan, WeeklyReview } from '../types/domain'

const dailyPlanRaw = createRepository<DailyPlan>('dailyPlans')
const weeklyReviewRaw = createRepository<WeeklyReview>('weeklyReviews')

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
    dailyPlanRaw.removeMany(plans.map((p) => p.id)),
    weeklyReviewRaw.removeMany(reviews.map((r) => r.id)),
  ])
}

function renderSettings() {
  return renderWithProviders(<SettingsPage />, { route: '/settings', path: '/settings' })
}

beforeEach(async () => {
  await clearAllRecords()
  // jsdom doesn't implement the Blob download APIs; stub them so the export
  // button's click handler can run without throwing.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  localStorage.removeItem('life-grid-theme')
  document.documentElement.removeAttribute('data-theme')
})

afterEach(async () => {
  await clearAllRecords()
  vi.restoreAllMocks()
  localStorage.removeItem('life-grid-theme')
  document.documentElement.removeAttribute('data-theme')
})

function makeBackupFile(content: unknown, name = 'backup.json'): File {
  return new File([JSON.stringify(content)], name, { type: 'application/json' })
}

describe('SettingsPage — appearance', () => {
  it('defaults to "Default" with no theme attribute, following the OS setting', async () => {
    renderSettings()

    const defaultOption = await screen.findByRole('radio', { name: /default/i })
    expect(defaultOption).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('switches to light mode immediately and persists the choice', async () => {
    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /^light$/i }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('life-grid-theme')).toBe('light')
  })

  it('switches to dark mode immediately and persists the choice', async () => {
    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /^dark$/i }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('life-grid-theme')).toBe('dark')
  })

  it('returning to "Default" removes the manual override entirely', async () => {
    renderSettings()

    fireEvent.click(await screen.findByRole('radio', { name: /^dark$/i }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    fireEvent.click(screen.getByRole('radio', { name: /default/i }))

    expect(document.documentElement).not.toHaveAttribute('data-theme')
    expect(localStorage.getItem('life-grid-theme')).toBe('system')
  })

  it('restores a previously saved theme choice on load', async () => {
    localStorage.setItem('life-grid-theme', 'dark')

    renderSettings()

    const darkOption = await screen.findByRole('radio', { name: /^dark$/i })
    expect(darkOption).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })
})

describe('SettingsPage — data statistics', () => {
  it('shows real record counts from actual data', async () => {
    await projectsRepo.create({ name: 'Real project' })
    await projectsRepo.create({ name: 'Sample project', isDemo: true })

    renderSettings()

    await screen.findByText('Data statistics')
    const projectsLabel = screen.getByText('Projects')
    expect(projectsLabel.parentElement).toHaveTextContent('1')
    expect(projectsLabel).toHaveTextContent('+1 sample')
  })

  it('counts a saved daily plan instead of always reading zero', async () => {
    // Regression test: the count itself was correct, but with no UI path
    // that had ever actually written a daily-plan record, it always read
    // zero — indistinguishable from a bug. This proves it tracks real data.
    const task = await tasksRepo.create({ title: 'Plan me' })
    await dailyPlansRepo.addTask('2026-10-22', task.id)

    renderSettings()

    await screen.findByText('Data statistics')
    const label = screen.getByText('Daily plans')
    expect(label.parentElement).toHaveTextContent('1')
  })
})

describe('SettingsPage — export', () => {
  it('downloads a backup when the button is clicked', async () => {
    await projectsRepo.create({ name: 'Export me' })
    renderSettings()

    fireEvent.click(await screen.findByRole('button', { name: /download backup/i }))

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled())
  })
})

describe('SettingsPage — restore', () => {
  it('rejects a file that is not valid JSON', async () => {
    renderSettings()
    await screen.findByText('Restore from backup')
    const input = screen.getByLabelText('Choose a Life Grid backup file')
    const badFile = new File(['not json'], 'bad.json', { type: 'application/json' })

    fireEvent.change(input, { target: { files: [badFile] } })

    expect(await screen.findByText(/not valid json/i)).toBeInTheDocument()
  })

  it('rejects an unsupported backup and shows an understandable message', async () => {
    renderSettings()
    await screen.findByText('Restore from backup')
    const input = screen.getByLabelText('Choose a Life Grid backup file')

    fireEvent.change(input, { target: { files: [makeBackupFile({ format: 'nope', version: 1 })] } })

    expect(await screen.findByText(/couldn't be used/i)).toBeInTheDocument()
    expect(screen.getByText(/not a Life Grid backup/i)).toBeInTheDocument()
  })

  it('shows a preview with record counts before committing anything', async () => {
    const backup = await createBackup({ includeDemoData: true })
    backup.data.projects.push({
      id: 'incoming-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'From backup',
      description: '',
      status: 'active',
      color: 'violet',
    })

    renderSettings()
    await screen.findByText('Restore from backup')
    const input = screen.getByLabelText('Choose a Life Grid backup file')
    fireEvent.change(input, { target: { files: [makeBackupFile(backup)] } })

    expect(await screen.findByRole('button', { name: /merge backup/i })).toBeInTheDocument()
    // The preview table shows the counts this restore would apply...
    expect(screen.getByText('1', { selector: 'td' })).toBeInTheDocument() // 1 project would be added
    // ...and nothing has actually been written to the database yet.
    expect(await projectsRepo.list()).toHaveLength(0)
  })

  it('merges a backup and leaves unrelated existing records in place', async () => {
    await projectsRepo.create({ name: 'Already here' })
    const backup = await createBackup({ includeDemoData: true })
    backup.data.projects.push({
      id: 'incoming-2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Merged in',
      description: '',
      status: 'active',
      color: 'violet',
    })

    renderSettings()
    await screen.findByText('Restore from backup')
    fireEvent.change(screen.getByLabelText('Choose a Life Grid backup file'), {
      target: { files: [makeBackupFile(backup)] },
    })
    fireEvent.click(await screen.findByRole('button', { name: /merge backup/i }))

    await waitFor(() => expect(screen.getByText(/restore complete/i)).toBeInTheDocument())
    const names = (await projectsRepo.list()).map((p) => p.name).sort()
    expect(names).toEqual(['Already here', 'Merged in'])
  })

  it('requires a safety backup download before allowing Replace to run', async () => {
    const backup = await createBackup({ includeDemoData: true })
    renderSettings()
    await screen.findByText('Restore from backup')
    fireEvent.change(screen.getByLabelText('Choose a Life Grid backup file'), {
      target: { files: [makeBackupFile(backup)] },
    })
    fireEvent.click(await screen.findByLabelText(/replace/i))

    const replaceButton = screen.getByRole('button', { name: /replace data/i })
    expect(replaceButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /download current data now/i }))
    await waitFor(() => expect(replaceButton).not.toBeDisabled())
  })

  it('replaces existing data after the safety backup is downloaded', async () => {
    const backup = await createBackup({ includeDemoData: true })
    await projectsRepo.create({ name: 'Old data' })
    backup.data.projects.push({
      id: 'incoming-3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Replacement data',
      description: '',
      status: 'active',
      color: 'violet',
    })

    renderSettings()
    await screen.findByText('Restore from backup')
    fireEvent.change(screen.getByLabelText('Choose a Life Grid backup file'), {
      target: { files: [makeBackupFile(backup)] },
    })
    fireEvent.click(await screen.findByLabelText(/replace/i))
    fireEvent.click(screen.getByRole('button', { name: /download current data now/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /replace data/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /replace data/i }))

    await waitFor(async () => {
      const all = await projectsRepo.list()
      expect(all).toHaveLength(1)
      expect(all[0].name).toBe('Replacement data')
    })
  })

  it('refreshes application state after a restore so the UI reflects it without a manual reload', async () => {
    const backup = await createBackup({ includeDemoData: true })
    backup.data.projects.push({
      id: 'incoming-4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Freshly restored project',
      description: '',
      status: 'active',
      color: 'violet',
    })

    renderSettings()
    await screen.findByText('Restore from backup')
    fireEvent.change(screen.getByLabelText('Choose a Life Grid backup file'), {
      target: { files: [makeBackupFile(backup)] },
    })
    fireEvent.click(await screen.findByRole('button', { name: /merge backup/i }))

    // The stats section (reading live context state) should pick up the
    // restored project count without the test reloading or re-rendering.
    await waitFor(() => {
      const projectsLabel = screen.getByText('Projects')
      expect(projectsLabel.parentElement).toHaveTextContent('1')
    })
  })
})

describe('SettingsPage — danger zone', () => {
  it('requires typing the confirmation phrase before clearing real data is enabled', async () => {
    await projectsRepo.create({ name: 'Real project' })
    renderSettings()

    const clearButton = await screen.findByRole('button', { name: /clear all real data/i })
    expect(clearButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } })
    expect(clearButton).not.toBeDisabled()
  })

  it('clears real data but preserves sample data when confirmed', async () => {
    await projectsRepo.create({ name: 'Real project', isDemo: false })
    await projectsRepo.create({ name: 'Sample project', isDemo: true })

    renderSettings()
    fireEvent.change(await screen.findByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: /clear all real data/i }))

    await waitFor(async () => {
      const remaining = await projectsRepo.list()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].name).toBe('Sample project')
    })
  })
})
