import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { focusSessionsRepo } from '../data/focusSessions'
import { notesRepo } from '../data/notes'
import { projectsRepo } from '../data/projects'
import { tasksRepo } from '../data/tasks'
import { renderProjectsApp } from '../test/testUtils'

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

describe('ProjectsPage', () => {
  it('shows an empty state with a Create project action when there are no projects', async () => {
    renderProjectsApp('/projects')

    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /create project/i }).length).toBeGreaterThan(0)
  })

  it('renders existing projects in the list', async () => {
    await projectsRepo.create({ name: 'Website redesign', status: 'active' })
    await projectsRepo.create({ name: 'Tax prep', status: 'paused' })

    renderProjectsApp('/projects')

    expect(await screen.findByText('Website redesign')).toBeInTheDocument()
    expect(screen.getByText('Tax prep')).toBeInTheDocument()
  })

  it('rejects an empty project name with a validation error and does not create it', async () => {
    renderProjectsApp('/projects')

    await screen.findByText('No projects yet')
    fireEvent.click(screen.getAllByRole('button', { name: /create project/i })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /^create project$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/project name is required/i)
    expect(await projectsRepo.list()).toHaveLength(0)
  })

  it('creates a project through the form and shows it in the list immediately', async () => {
    renderProjectsApp('/projects')

    await screen.findByText('No projects yet')
    fireEvent.click(screen.getAllByRole('button', { name: /create project/i })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'New kitchen' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /^create project$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('New kitchen')).toBeInTheDocument()
    expect(await projectsRepo.list()).toHaveLength(1)
  })

  it('combines search and status filter correctly', async () => {
    await projectsRepo.create({ name: 'Garden overhaul', status: 'active' })
    await projectsRepo.create({ name: 'Garden shed', status: 'completed' })
    await projectsRepo.create({ name: 'Finances', status: 'active' })

    renderProjectsApp('/projects')
    await screen.findByText('Garden overhaul')

    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'garden' } })
    expect(screen.getByText('Garden overhaul')).toBeInTheDocument()
    expect(screen.getByText('Garden shed')).toBeInTheDocument()
    expect(screen.queryByText('Finances')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'active' } })
    expect(screen.getByText('Garden overhaul')).toBeInTheDocument()
    expect(screen.queryByText('Garden shed')).not.toBeInTheDocument()
    expect(screen.queryByText('Finances')).not.toBeInTheDocument()
  })

  it('shows a no-results state with a clear-filters action when filters match nothing', async () => {
    await projectsRepo.create({ name: 'Garden overhaul', status: 'active' })

    renderProjectsApp('/projects')
    await screen.findByText('Garden overhaul')

    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'nonexistent project' } })

    expect(await screen.findByText('No projects match your filters')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))

    expect(await screen.findByText('Garden overhaul')).toBeInTheDocument()
  })
})
