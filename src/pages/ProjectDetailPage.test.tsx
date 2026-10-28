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

describe('ProjectDetailPage', () => {
  it('shows a not-found state with a link back for a missing project id', async () => {
    renderProjectsApp('/projects/does-not-exist')

    expect(await screen.findByText('Project not found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to projects/i })).toBeInTheDocument()
  })

  it('renders an existing project with its details and empty task board', async () => {
    const project = await projectsRepo.create({
      name: 'Backyard patio',
      description: 'Build a stone patio',
      status: 'active',
      priority: 'high',
    })

    renderProjectsApp(`/projects/${project.id}`)

    expect(await screen.findByRole('heading', { name: 'Backyard patio' })).toBeInTheDocument()
    expect(screen.getByText('Build a stone patio')).toBeInTheDocument()
    expect(screen.getByText('No tasks in this project yet')).toBeInTheDocument()
  })

  it('creates a task scoped to the current project and keeps other projects’ tasks out of the board', async () => {
    const project = await projectsRepo.create({ name: 'Backyard patio' })
    const otherProject = await projectsRepo.create({ name: 'Unrelated project' })
    await tasksRepo.create({ title: 'Belongs elsewhere', projectId: otherProject.id })

    renderProjectsApp(`/projects/${project.id}`)
    await screen.findByText('No tasks in this project yet')

    fireEvent.click(screen.getAllByRole('button', { name: /add task/i })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Lay the stones' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /^add task$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Lay the stones')).toBeInTheDocument()
    expect(screen.queryByText('Belongs elsewhere')).not.toBeInTheDocument()

    const tasks = await tasksRepo.list()
    const created = tasks.find((t) => t.title === 'Lay the stones')
    expect(created?.projectId).toBe(project.id)
  })

  it('persists a task status change and updates project progress', async () => {
    const project = await projectsRepo.create({ name: 'Backyard patio' })
    const task = await tasksRepo.create({ title: 'Lay the stones', projectId: project.id, status: 'todo' })

    renderProjectsApp(`/projects/${project.id}`)
    const taskTitle = await screen.findByText('Lay the stones')
    const card = taskTitle.closest('div.rounded-xl') as HTMLElement
    const statusSelect = within(card).getByRole('combobox')

    fireEvent.change(statusSelect, { target: { value: 'done' } })

    await waitFor(async () => {
      const updated = await tasksRepo.get(task.id)
      expect(updated?.status).toBe('done')
      expect(updated?.completedAt).toBeTruthy()
    })
  })

  it('reassigns a task to a different project through the edit form', async () => {
    // Regression test: editing a task from within a project's board used to
    // lock TaskFormModal's project to that project (to support the "quick
    // add" flow) — but the same lock applied when *editing*, hiding the
    // project picker entirely and silently forcing the save back to the
    // original project even if a picker had somehow been shown. There was
    // no way, anywhere in the app, to move an existing task to a different
    // project or unassign it.
    const origin = await projectsRepo.create({ name: 'Origin project' })
    const destination = await projectsRepo.create({ name: 'Destination project' })
    const task = await tasksRepo.create({ title: 'Movable task', projectId: origin.id })

    renderProjectsApp(`/projects/${origin.id}`)
    const taskTitle = await screen.findByText('Movable task')
    const card = taskTitle.closest('div.rounded-xl') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: /edit "movable task"/i }))

    const dialog = await screen.findByRole('dialog')
    const projectPicker = within(dialog).getByLabelText('Project (optional)')
    fireEvent.change(projectPicker, { target: { value: destination.id } })
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await waitFor(async () => {
      const updated = await tasksRepo.get(task.id)
      expect(updated?.projectId).toBe(destination.id)
    })
    // The origin project's board must no longer show it.
    expect(screen.queryByText('Movable task')).not.toBeInTheDocument()
  })

  it('unassigns a task from its project through the edit form', async () => {
    const project = await projectsRepo.create({ name: 'Origin project' })
    const task = await tasksRepo.create({ title: 'Freeable task', projectId: project.id })

    renderProjectsApp(`/projects/${project.id}`)
    const taskTitle = await screen.findByText('Freeable task')
    const card = taskTitle.closest('div.rounded-xl') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: /edit "freeable task"/i }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Project (optional)'), { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await waitFor(async () => {
      const updated = await tasksRepo.get(task.id)
      expect(updated?.projectId).toBeUndefined()
    })
  })

  it('edits project details and persists the change', async () => {
    const project = await projectsRepo.create({ name: 'Backyard patio' })

    renderProjectsApp(`/projects/${project.id}`)
    await screen.findByRole('heading', { name: 'Backyard patio' })

    fireEvent.click(screen.getByRole('button', { name: /edit project/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Backyard patio & pergola' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(
      await screen.findByRole('heading', { name: 'Backyard patio & pergola' }),
    ).toBeInTheDocument()

    const stored = await projectsRepo.get(project.id)
    expect(stored?.name).toBe('Backyard patio & pergola')
  })

  it('the inline colour picker does not pre-select a swatch for a project with no explicit colour', async () => {
    const project = await projectsRepo.create({ name: 'Backyard patio' })
    expect(project.color).toBe('')

    renderProjectsApp(`/projects/${project.id}`)
    await screen.findByRole('heading', { name: 'Backyard patio' })

    fireEvent.click(screen.getByRole('button', { name: /change project colour/i }))
    const picker = await screen.findByRole('radiogroup', { name: /project colour/i })
    for (const radio of within(picker).getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false')
    }
  })

  it('picking a colour from the inline picker persists it as an explicit override', async () => {
    const project = await projectsRepo.create({ name: 'Backyard patio' })

    renderProjectsApp(`/projects/${project.id}`)
    await screen.findByRole('heading', { name: 'Backyard patio' })

    fireEvent.click(screen.getByRole('button', { name: /change project colour/i }))
    const picker = await screen.findByRole('radiogroup', { name: /project colour/i })
    fireEvent.click(within(picker).getByRole('radio', { name: 'Teal' }))

    await waitFor(async () => {
      const stored = await projectsRepo.get(project.id)
      expect(stored?.color).toBe('teal')
    })
  })

  it('deletes a project, redirects to the list, and preserves its tasks as unassigned', async () => {
    const project = await projectsRepo.create({ name: 'Backyard patio' })
    const task = await tasksRepo.create({ title: 'Lay the stones', projectId: project.id })

    renderProjectsApp(`/projects/${project.id}`)
    await screen.findByRole('heading', { name: 'Backyard patio' })

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/kept and become unassigned/i)
    fireEvent.click(within(dialog).getByRole('button', { name: /delete project/i }))

    expect(await screen.findByText('Projects')).toBeInTheDocument()
    expect(screen.queryByText('Backyard patio')).not.toBeInTheDocument()

    expect(await projectsRepo.get(project.id)).toBeUndefined()
    const survivingTask = await tasksRepo.get(task.id)
    expect(survivingTask).toBeDefined()
    expect(survivingTask?.projectId).toBeUndefined()
  })

  it('shows only notes linked to this project, not notes from other projects or unassigned notes', async () => {
    const project = await projectsRepo.create({ name: 'Backyard patio' })
    const otherProject = await projectsRepo.create({ name: 'Unrelated project' })
    await notesRepo.create({ title: 'Patio inspiration', projectId: project.id })
    await notesRepo.create({ title: 'Belongs elsewhere', projectId: otherProject.id })
    await notesRepo.create({ title: 'Unassigned musings' })

    renderProjectsApp(`/projects/${project.id}`)

    expect(await screen.findByText('Patio inspiration')).toBeInTheDocument()
    expect(screen.queryByText('Belongs elsewhere')).not.toBeInTheDocument()
    expect(screen.queryByText('Unassigned musings')).not.toBeInTheDocument()
  })

  it('creates a recurring weekly task and shows a recurrence indicator', async () => {
    const project = await projectsRepo.create({ name: 'Recurrence project' })
    renderProjectsApp(`/projects/${project.id}`)
    await screen.findByText('No tasks in this project yet')

    fireEvent.click(screen.getAllByRole('button', { name: /add task/i })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Water the plants' } })
    fireEvent.change(within(dialog).getByLabelText('Due date'), { target: { value: '2026-03-10' } })
    fireEvent.click(within(dialog).getByLabelText('Repeat this task'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Weekly' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mon' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /^add task$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(await screen.findByText('Repeats')).toBeInTheDocument()
    const stored = (await tasksRepo.list())[0]
    expect(stored.recurrence).toEqual({ frequency: 'weekly', weekdays: [1], endDate: undefined, dayOfMonth: undefined })
  })

  it('requires a due date before a task can repeat', async () => {
    const project = await projectsRepo.create({ name: 'Recurrence project' })
    renderProjectsApp(`/projects/${project.id}`)
    await screen.findByText('No tasks in this project yet')

    fireEvent.click(screen.getAllByRole('button', { name: /add task/i })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'No due date task' } })
    fireEvent.click(within(dialog).getByLabelText('Repeat this task'))
    fireEvent.click(within(dialog).getByRole('button', { name: /^add task$/i }))

    expect(await screen.findByText(/recurring tasks need a due date/i)).toBeInTheDocument()
    expect(await tasksRepo.list()).toHaveLength(0)
  })

  it('validates the monthly day-of-month range', async () => {
    const project = await projectsRepo.create({ name: 'Recurrence project' })
    renderProjectsApp(`/projects/${project.id}`)
    await screen.findByText('No tasks in this project yet')

    fireEvent.click(screen.getAllByRole('button', { name: /add task/i })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Pay rent' } })
    fireEvent.change(within(dialog).getByLabelText('Due date'), { target: { value: '2026-03-10' } })
    fireEvent.click(within(dialog).getByLabelText('Repeat this task'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Monthly' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /^add task$/i }))

    expect(await screen.findByText(/choose a day of the month between 1 and 31/i)).toBeInTheDocument()
    expect(await tasksRepo.list()).toHaveLength(0)
  })

  it('completing a recurring task preserves it as done and creates the next occurrence', async () => {
    const project = await projectsRepo.create({ name: 'Recurrence project' })
    const task = await tasksRepo.create({
      title: 'Daily standup notes',
      projectId: project.id,
      dueDate: '2026-03-10',
      recurrence: { frequency: 'daily' },
    })

    renderProjectsApp(`/projects/${project.id}`)
    const taskTitle = await screen.findByText('Daily standup notes')
    const card = taskTitle.closest('div.rounded-xl') as HTMLElement
    const statusSelect = within(card).getByRole('combobox')
    fireEvent.change(statusSelect, { target: { value: 'done' } })

    await waitFor(async () => {
      const original = await tasksRepo.get(task.id)
      expect(original?.status).toBe('done')
    })

    await waitFor(async () => {
      const all = await tasksRepo.list()
      const next = all.find((t) => t.recurrenceParentId === task.id)
      expect(next).toBeDefined()
      expect(next?.dueDate).toBe('2026-03-11')
      expect(next?.status).toBe('todo')
    })

    // Both the completed original and the fresh next occurrence are visible on the board.
    expect(await screen.findAllByText('Daily standup notes')).toHaveLength(2)
  })

  it('disabling recurrence through the edit form stops future occurrence generation', async () => {
    const project = await projectsRepo.create({ name: 'Recurrence project' })
    const task = await tasksRepo.create({
      title: 'Stoppable task',
      projectId: project.id,
      dueDate: '2026-03-10',
      recurrence: { frequency: 'daily' },
    })

    renderProjectsApp(`/projects/${project.id}`)
    const taskTitle = await screen.findByText('Stoppable task')
    const card = taskTitle.closest('div.rounded-xl') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: /edit "stoppable task"/i }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByLabelText('Repeat this task'))
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await tasksRepo.completeTask(task.id)

    const all = await tasksRepo.list()
    expect(all).toHaveLength(1) // only the completed record — no next occurrence
    expect(all[0].recurrence).toBeUndefined()
  })
})
