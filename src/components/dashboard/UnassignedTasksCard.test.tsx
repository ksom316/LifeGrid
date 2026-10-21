import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { projectsRepo } from '../../data/projects'
import { tasksRepo } from '../../data/tasks'
import { renderWithProviders } from '../../test/testUtils'
import { DashboardPage } from '../../pages/DashboardPage'

async function clearAllTasks() {
  const [tasks, projects] = await Promise.all([tasksRepo.list(), projectsRepo.list()])
  await Promise.all([
    tasksRepo.removeMany(tasks.map((t) => t.id)),
    projectsRepo.removeMany(projects.map((p) => p.id)),
  ])
}

beforeEach(async () => {
  await clearAllTasks()
})

describe('Dashboard — adding a task with no project', () => {
  it('appears in "Other tasks" instead of disappearing after creation', async () => {
    renderWithProviders(<DashboardPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add task' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Unassigned dashboard task' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /^add task$/i }))

    // The modal closes on success, and the new task surfaces here — the only
    // place a project-less, non-urgent task is reachable from the Dashboard.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Unassigned dashboard task')).toBeInTheDocument()
  })

  it('shows a visible error and keeps the modal open when creation fails', async () => {
    const createSpy = vi.spyOn(tasksRepo, 'create').mockRejectedValueOnce(new Error('Storage is full'))
    renderWithProviders(<DashboardPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add task' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Should fail' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /^add task$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Should fail')

    createSpy.mockRestore()
  })
})
