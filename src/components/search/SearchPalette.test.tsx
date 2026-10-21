import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { focusSessionsRepo } from '../../data/focusSessions'
import { notesRepo } from '../../data/notes'
import { projectsRepo } from '../../data/projects'
import { tasksRepo } from '../../data/tasks'
import { renderShellApp } from '../../test/testUtils'

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

describe('Global search — opening and closing', () => {
  it('opens via the sidebar search trigger', async () => {
    renderShellApp('/')
    await screen.findByText('Dashboard')

    fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0])

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/search projects, tasks, and notes/i)).toHaveFocus()
  })

  it('opens with Ctrl+K and Cmd+K', async () => {
    renderShellApp('/')
    await screen.findByText('Dashboard')

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close dialog'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('does not open while typing in an ordinary text field', async () => {
    const project = await projectsRepo.create({ name: 'Existing project' })
    void project
    renderShellApp('/projects')
    await screen.findByText('Existing project')

    fireEvent.click(screen.getByRole('button', { name: /create project/i }))
    const dialog = await screen.findByRole('dialog')
    const nameInput = screen.getByLabelText('Name')
    nameInput.focus()

    fireEvent.keyDown(nameInput, { key: 'k', ctrlKey: true })

    // The project-creation dialog should still be the only dialog open —
    // the shortcut must not have opened the search palette on top of it.
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(screen.queryByPlaceholderText(/search projects, tasks, and notes/i)).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    renderShellApp('/')
    await screen.findByText('Dashboard')
    fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0])
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('clears the query via the clear button', async () => {
    renderShellApp('/')
    await screen.findByText('Dashboard')
    fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0])
    const input = await screen.findByPlaceholderText(/search projects, tasks, and notes/i)

    fireEvent.change(input, { target: { value: 'hello' } })
    expect(input).toHaveValue('hello')

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }))
    expect(input).toHaveValue('')
  })
})

describe('Global search — results and empty states', () => {
  it('shows guidance for an empty query and a no-results message otherwise', async () => {
    renderShellApp('/')
    await screen.findByText('Dashboard')
    fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0])
    const input = await screen.findByPlaceholderText(/search projects, tasks, and notes/i)

    expect(screen.getByText('Search your workspace')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'nothing matches this at all' } })
    expect(await screen.findByText(/no results for/i)).toBeInTheDocument()
  })

  it('reflects current data — a newly created project is searchable immediately', async () => {
    renderShellApp('/projects')
    await screen.findByText('No projects yet')

    fireEvent.click(screen.getAllByRole('button', { name: /create project/i })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Freshly created' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^create project$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0])
    const input = await screen.findByPlaceholderText(/search projects, tasks, and notes/i)
    fireEvent.change(input, { target: { value: 'freshly' } })

    expect(await screen.findByRole('option', { name: /freshly created/i })).toBeInTheDocument()
  })
})

describe('Global search — keyboard navigation and destinations', () => {
  it('navigates results with Arrow keys and opens the active one on Enter', async () => {
    await projectsRepo.create({ name: 'Alpha project' })
    await projectsRepo.create({ name: 'Alpha plan' })
    renderShellApp('/')
    await screen.findByText('Dashboard')
    fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0])
    const input = await screen.findByPlaceholderText(/search projects, tasks, and notes/i)
    fireEvent.change(input, { target: { value: 'alpha' } })
    await screen.findByRole('option', { name: /alpha project/i })

    // Both results tie on score ("alpha" is a title-prefix match for each),
    // so they sort alphabetically: "Alpha plan" (index 0) then
    // "Alpha project" (index 1). ArrowDown moves the active selection to
    // "Alpha project", and Enter opens it.
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('heading', { name: 'Alpha project' })).toBeInTheDocument()
  })

  it('opens a project result on its project detail page and closes search', async () => {
    const project = await projectsRepo.create({ name: 'Target project' })
    void project
    renderShellApp('/')
    await screen.findByText('Dashboard')
    fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0])
    const input = await screen.findByPlaceholderText(/search projects, tasks, and notes/i)
    fireEvent.change(input, { target: { value: 'target' } })
    fireEvent.click(await screen.findByRole('option', { name: /target project/i }))

    expect(await screen.findByRole('heading', { name: 'Target project' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a note result on its note detail page', async () => {
    await notesRepo.create({ title: 'Target note', content: 'content here' })
    renderShellApp('/')
    await screen.findByText('Dashboard')
    fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0])
    const input = await screen.findByPlaceholderText(/search projects, tasks, and notes/i)
    fireEvent.change(input, { target: { value: 'target note' } })
    fireEvent.click(await screen.findByRole('option', { name: /target note/i }))

    expect(await screen.findByRole('heading', { name: 'Target note' })).toBeInTheDocument()
  })

  it('opens a project-linked task result on the project page with the task highlighted', async () => {
    const project = await projectsRepo.create({ name: 'Task Home Project' })
    await tasksRepo.create({ title: 'Findable task', projectId: project.id })
    renderShellApp('/')
    await screen.findByText('Dashboard')
    fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0])
    const input = await screen.findByPlaceholderText(/search projects, tasks, and notes/i)
    fireEvent.change(input, { target: { value: 'findable' } })
    fireEvent.click(await screen.findByRole('option', { name: /findable task/i }))

    expect(await screen.findByRole('heading', { name: 'Task Home Project' })).toBeInTheDocument()
    expect(document.getElementById('task-' + (await tasksRepo.list())[0].id)).toHaveClass('border-brand')
  })

  it('falls back to the dashboard for an unassigned task result', async () => {
    await tasksRepo.create({ title: 'Orphan task' })
    renderShellApp('/projects')
    await screen.findByText('No projects yet')
    fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0])
    const input = await screen.findByPlaceholderText(/search projects, tasks, and notes/i)
    fireEvent.change(input, { target: { value: 'orphan' } })
    fireEvent.click(await screen.findByRole('option', { name: /orphan task/i }))

    expect(await screen.findByText(/good (morning|afternoon|evening|night)/i)).toBeInTheDocument()
  })
})
