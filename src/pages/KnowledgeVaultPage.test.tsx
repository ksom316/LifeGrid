import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { focusSessionsRepo } from '../data/focusSessions'
import { notesRepo } from '../data/notes'
import { projectsRepo } from '../data/projects'
import { tasksRepo } from '../data/tasks'
import { renderVaultApp } from '../test/testUtils'
import { colorForKey, colorHex, resolveProjectColor } from '../utils/colors'
import { resolveTagColor } from '../utils/tags'

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

describe('KnowledgeVaultPage', () => {
  it('shows an empty state with a Create note action when there are no notes', async () => {
    renderVaultApp('/vault')

    expect(await screen.findByText('No notes yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /create note/i }).length).toBeGreaterThan(0)
  })

  it('renders existing notes in the list', async () => {
    await notesRepo.create({ title: 'Reading list', content: 'Books to read this year' })
    await notesRepo.create({ title: 'Meeting notes' })

    renderVaultApp('/vault')

    expect(await screen.findByText('Reading list')).toBeInTheDocument()
    expect(screen.getByText('Meeting notes')).toBeInTheDocument()
  })

  it('rejects an empty note title with a validation error and does not create it', async () => {
    renderVaultApp('/vault')

    await screen.findByText('No notes yet')
    fireEvent.click(screen.getAllByRole('button', { name: /create note/i })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /^create note$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/note title is required/i)
    expect(await notesRepo.list()).toHaveLength(0)
  })

  it('creates a note through the form and shows it in the list immediately', async () => {
    renderVaultApp('/vault')

    await screen.findByText('No notes yet')
    fireEvent.click(screen.getAllByRole('button', { name: /create note/i })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Grocery ideas' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /^create note$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Grocery ideas')).toBeInTheDocument()
    expect(await notesRepo.list()).toHaveLength(1)
  })

  it('edits a note through the form and persists the change', async () => {
    const note = await notesRepo.create({ title: 'Draft title', content: 'Draft content' })

    renderVaultApp('/vault')
    await screen.findByText('Draft title')

    fireEvent.click(screen.getByRole('button', { name: /edit "draft title"/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Final title' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Final title')).toBeInTheDocument()

    const stored = await notesRepo.get(note.id)
    expect(stored?.title).toBe('Final title')
  })

  it('searches across both titles and content', async () => {
    await notesRepo.create({ title: 'Trip planning', content: 'Book flights and hotel' })
    await notesRepo.create({ title: 'Recipe', content: 'Needs fresh basil' })

    renderVaultApp('/vault')
    await screen.findByText('Trip planning')

    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'basil' } })
    expect(screen.queryByText('Trip planning')).not.toBeInTheDocument()
    expect(screen.getByText('Recipe')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'flights' } })
    expect(screen.getByText('Trip planning')).toBeInTheDocument()
    expect(screen.queryByText('Recipe')).not.toBeInTheDocument()
  })

  it('combines search with the tag filter correctly', async () => {
    await notesRepo.create({ title: 'Garden journal', tags: ['garden'] })
    await notesRepo.create({ title: 'Garden shopping list', tags: ['garden', 'errands'] })
    await notesRepo.create({ title: 'Work retro', tags: ['work'] })

    renderVaultApp('/vault')
    await screen.findByText('Garden journal')

    fireEvent.change(screen.getByLabelText('Filter by tag'), { target: { value: 'garden' } })
    expect(screen.getByText('Garden journal')).toBeInTheDocument()
    expect(screen.getByText('Garden shopping list')).toBeInTheDocument()
    expect(screen.queryByText('Work retro')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'shopping' } })
    expect(screen.queryByText('Garden journal')).not.toBeInTheDocument()
    expect(screen.getByText('Garden shopping list')).toBeInTheDocument()
  })

  it('shows a no-results state with a clear-filters action when filters match nothing', async () => {
    await notesRepo.create({ title: 'Garden journal' })

    renderVaultApp('/vault')
    await screen.findByText('Garden journal')

    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'nonexistent note' } })

    expect(await screen.findByText('No notes match your filters')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))

    expect(await screen.findByText('Garden journal')).toBeInTheDocument()
  })

  it('sorts notes by title', async () => {
    await notesRepo.create({ title: 'Zebra notes' })
    await notesRepo.create({ title: 'Apple notes' })

    renderVaultApp('/vault')
    await screen.findByText('Zebra notes')

    fireEvent.change(screen.getByLabelText('Sort notes'), { target: { value: 'title' } })

    const titles = screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)
    expect(titles).toEqual(['Apple notes', 'Zebra notes'])
  })

  it('pins a note so it floats to the top regardless of sort order', async () => {
    await notesRepo.create({ title: 'Older note' })
    await notesRepo.create({ title: 'Newer note' })

    renderVaultApp('/vault')
    await screen.findByText('Newer note')

    fireEvent.click(screen.getByRole('button', { name: /pin "older note"/i }))

    await waitFor(() => {
      const titles = screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)
      expect(titles[0]).toBe('Older note')
    })
  })

  it('links a note to a project, shows the project badge, and navigates to it', async () => {
    const project = await projectsRepo.create({ name: 'Kitchen remodel' })
    await notesRepo.create({ title: 'Design notes', projectId: project.id })

    renderVaultApp('/vault')
    await screen.findByText('Design notes')

    const projectLink = screen.getByRole('link', { name: /kitchen remodel/i })
    fireEvent.click(projectLink)

    expect(await screen.findByRole('heading', { name: 'Kitchen remodel' })).toBeInTheDocument()
  })

  it("tints a note card's background with its project's colour when linked to a project", async () => {
    const project = await projectsRepo.create({ name: 'Kitchen remodel', color: 'teal' })
    await notesRepo.create({ title: 'Design notes', projectId: project.id, tags: ['should-be-ignored'] })

    renderVaultApp('/vault')
    const heading = await screen.findByText('Design notes')
    const card = heading.closest('div[style]') as HTMLElement
    expect(card.style.backgroundColor).toContain(colorHex(resolveProjectColor(project)))
  })

  it("tints a note card's background with its first tag's colour when it has no project", async () => {
    await notesRepo.create({ title: 'Tagged note', tags: ['planning', 'ideas'] })

    renderVaultApp('/vault')
    const heading = await screen.findByText('Tagged note')
    const card = heading.closest('div[style]') as HTMLElement
    expect(card.style.backgroundColor).toContain(colorHex(resolveTagColor([], 'planning')))
  })

  it("tints a note card's background with a colour derived from its own id when it has neither a project nor tags", async () => {
    const note = await notesRepo.create({ title: 'Plain note' })

    renderVaultApp('/vault')
    const heading = await screen.findByText('Plain note')
    const card = heading.closest('div[style]') as HTMLElement
    expect(card.style.backgroundColor).toContain(colorHex(colorForKey(note.id)))
  })

  it('isolates demo data: removing it never deletes real notes', async () => {
    await notesRepo.create({ title: 'Real note', isDemo: false })
    await notesRepo.create({ title: 'Sample note', isDemo: true })

    const all = await notesRepo.list()
    expect(all).toHaveLength(2)

    await notesRepo.removeMany(all.filter((n) => n.isDemo).map((n) => n.id))

    const remaining = await notesRepo.list()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].title).toBe('Real note')
  })
})
