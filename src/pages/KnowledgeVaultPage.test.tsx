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

  it('filters notes by project, including an "Unassigned" option for notes without a project', async () => {
    const kitchen = await projectsRepo.create({ name: 'Kitchen remodel' })
    const garden = await projectsRepo.create({ name: 'Garden plan' })
    await notesRepo.create({ title: 'Cabinet ideas', projectId: kitchen.id })
    await notesRepo.create({ title: 'Seed list', projectId: garden.id })
    await notesRepo.create({ title: 'Loose thought' })

    renderVaultApp('/vault')
    await screen.findByText('Cabinet ideas')

    fireEvent.change(screen.getByLabelText('Filter by project'), { target: { value: kitchen.id } })
    expect(screen.getByText('Cabinet ideas')).toBeInTheDocument()
    expect(screen.queryByText('Seed list')).not.toBeInTheDocument()
    expect(screen.queryByText('Loose thought')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filter by project'), { target: { value: 'unassigned' } })
    expect(screen.queryByText('Cabinet ideas')).not.toBeInTheDocument()
    expect(screen.queryByText('Seed list')).not.toBeInTheDocument()
    expect(screen.getByText('Loose thought')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filter by project'), { target: { value: 'all' } })
    expect(screen.getByText('Cabinet ideas')).toBeInTheDocument()
    expect(screen.getByText('Seed list')).toBeInTheDocument()
    expect(screen.getByText('Loose thought')).toBeInTheDocument()
  })

  it('combines the project filter with search and tag filters, and resets it via clear filters', async () => {
    const kitchen = await projectsRepo.create({ name: 'Kitchen remodel' })
    await notesRepo.create({
      title: 'Cabinet ideas',
      content: 'Oak finish',
      tags: ['kitchen'],
      projectId: kitchen.id,
    })
    await notesRepo.create({
      title: 'Appliance ideas',
      content: 'Steel finish',
      tags: ['kitchen', 'appliances'],
      projectId: kitchen.id,
    })
    await notesRepo.create({ title: 'Unrelated note', tags: ['kitchen'] })

    renderVaultApp('/vault')
    await screen.findByText('Cabinet ideas')

    fireEvent.change(screen.getByLabelText('Filter by project'), { target: { value: kitchen.id } })
    fireEvent.change(screen.getByLabelText('Filter by tag'), { target: { value: 'kitchen' } })
    expect(screen.getByText('Cabinet ideas')).toBeInTheDocument()
    expect(screen.getByText('Appliance ideas')).toBeInTheDocument()
    expect(screen.queryByText('Unrelated note')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'oak' } })
    expect(screen.getByText('Cabinet ideas')).toBeInTheDocument()
    expect(screen.queryByText('Appliance ideas')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'nonexistent' } })
    expect(await screen.findByText('No notes match your filters')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(await screen.findByText('Cabinet ideas')).toBeInTheDocument()
    expect(screen.getByText('Appliance ideas')).toBeInTheDocument()
    expect(screen.getByText('Unrelated note')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by project')).toHaveValue('all')
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

  describe('pin icon visual state', () => {
    function pinIconFill(button: HTMLElement): string | null {
      return button.querySelector('svg path')?.getAttribute('fill') ?? null
    }

    it('shows a muted outline pin icon for an unpinned note', async () => {
      await notesRepo.create({ title: 'Unpinned note' })

      renderVaultApp('/vault')
      const pinButton = await screen.findByRole('button', { name: 'Pin "Unpinned note"' })

      expect(pinButton).toHaveAttribute('aria-pressed', 'false')
      // The outline icon's head path has no solid fill.
      expect(pinIconFill(pinButton)).not.toBe('currentColor')
      // No persistent accent background/border for the muted, unpinned state
      // (hover:bg-brand-soft is fine — only the non-hover persistent tint is checked).
      expect(pinButton.className).not.toContain('bg-brand/10')
    })

    it('shows a highlighted, filled pin icon for a pinned note', async () => {
      await notesRepo.create({ title: 'Pinned note', pinned: true })

      renderVaultApp('/vault')
      const pinButton = await screen.findByRole('button', { name: 'Unpin "Pinned note"' })

      expect(pinButton).toHaveAttribute('aria-pressed', 'true')
      // The filled icon's head path is solid.
      expect(pinIconFill(pinButton)).toBe('currentColor')
      // A persistent accent background marks the pinned state, not just a hover effect.
      expect(pinButton.className).toContain('bg-brand/10')
    })

    it('swaps between the outline and filled pin icon immediately when toggled', async () => {
      await notesRepo.create({ title: 'Toggle me' })

      renderVaultApp('/vault')
      let pinButton = await screen.findByRole('button', { name: 'Pin "Toggle me"' })
      expect(pinIconFill(pinButton)).not.toBe('currentColor')

      fireEvent.click(pinButton)

      pinButton = await screen.findByRole('button', { name: 'Unpin "Toggle me"' })
      expect(pinIconFill(pinButton)).toBe('currentColor')

      fireEvent.click(pinButton)

      pinButton = await screen.findByRole('button', { name: 'Pin "Toggle me"' })
      expect(pinIconFill(pinButton)).not.toBe('currentColor')
    })

    it('persists the pinned state across a reload', async () => {
      const note = await notesRepo.create({ title: 'Reload check' })

      renderVaultApp('/vault')
      fireEvent.click(await screen.findByRole('button', { name: 'Pin "Reload check"' }))
      await screen.findByRole('button', { name: 'Unpin "Reload check"' })

      expect((await notesRepo.get(note.id))?.pinned).toBe(true)

      renderVaultApp('/vault')
      const pinButtons = await screen.findAllByRole('button', { name: 'Unpin "Reload check"' })
      expect(pinButtons.length).toBeGreaterThan(0)
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

  describe('whole-card click behaviour', () => {
    it('clicking anywhere on the card (not just the title) opens the note', async () => {
      await notesRepo.create({ title: 'Trip planning', content: 'Pack sunscreen and chargers.' })

      renderVaultApp('/vault')
      await screen.findByText('Trip planning')

      // Click the content preview, not the title.
      fireEvent.click(screen.getByText('Pack sunscreen and chargers.'))

      expect(await screen.findByRole('heading', { name: 'Trip planning' })).toBeInTheDocument()
    })

    it('is reachable by keyboard and opens the note on Enter', async () => {
      await notesRepo.create({ title: 'Reading list' })

      renderVaultApp('/vault')
      const card = await screen.findByRole('link', { name: 'Reading list' })
      card.focus()
      fireEvent.keyDown(card, { key: 'Enter' })

      expect(await screen.findByRole('heading', { name: 'Reading list' })).toBeInTheDocument()
    })

    it('is reachable by keyboard and opens the note on Space', async () => {
      await notesRepo.create({ title: 'Grocery list' })

      renderVaultApp('/vault')
      const card = await screen.findByRole('link', { name: 'Grocery list' })
      card.focus()
      fireEvent.keyDown(card, { key: ' ' })

      expect(await screen.findByRole('heading', { name: 'Grocery list' })).toBeInTheDocument()
    })

    it('clicking the pin button toggles the pin without navigating away', async () => {
      await notesRepo.create({ title: 'Focus note' })

      renderVaultApp('/vault')
      await screen.findByText('Focus note')

      const pinButton = screen.getByRole('button', { name: 'Pin "Focus note"' })
      fireEvent.click(pinButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Unpin "Focus note"' })).toBeInTheDocument()
      })
      // Still on the list page, not navigated to the note detail route
      // (which renders a distinct "Back to Knowledge Vault" link).
      expect(screen.queryByText(/back to knowledge vault/i)).not.toBeInTheDocument()
    })

    it('clicking the edit button opens the edit dialog without navigating away', async () => {
      await notesRepo.create({ title: 'Edit target' })

      renderVaultApp('/vault')
      await screen.findByText('Edit target')

      fireEvent.click(screen.getByRole('button', { name: 'Edit "Edit target"' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Edit note')).toBeInTheDocument()
      // The card behind the dialog is still the list card, not the detail page.
      expect(screen.queryByText(/back to knowledge vault/i)).not.toBeInTheDocument()
    })

    it('typing in and saving the edit dialog does not navigate away from the list', async () => {
      const note = await notesRepo.create({ title: 'Edit target' })

      renderVaultApp('/vault')
      await screen.findByText('Edit target')
      fireEvent.click(screen.getByRole('button', { name: 'Edit "Edit target"' }))

      const dialog = await screen.findByRole('dialog')
      fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Edited title' } })
      fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(await screen.findByText('Edited title')).toBeInTheDocument()
      // Confirms the save round-tripped through the real update, not just UI state.
      expect((await notesRepo.get(note.id))?.title).toBe('Edited title')
      // Still on the vault list, not redirected to the note detail page.
      expect(screen.queryByRole('heading', { level: 1, name: 'Edited title' })).not.toBeInTheDocument()
    })

    it('clicking the delete button opens the confirm dialog without navigating, and confirming removes the note', async () => {
      await notesRepo.create({ title: 'Doomed note' })

      renderVaultApp('/vault')
      await screen.findByText('Doomed note')

      fireEvent.click(screen.getByRole('button', { name: 'Delete "Doomed note"' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByRole('heading', { name: 'Delete note' })).toBeInTheDocument()

      fireEvent.click(within(dialog).getByRole('button', { name: /delete note/i }))

      await waitFor(() => expect(screen.queryByText('Doomed note')).not.toBeInTheDocument())
    })

    it("clicking the project badge navigates to the project, not the note's own detail page", async () => {
      const project = await projectsRepo.create({ name: 'Kitchen remodel' })
      await notesRepo.create({ title: 'Design notes', projectId: project.id })

      renderVaultApp('/vault')
      await screen.findByText('Design notes')
      fireEvent.click(screen.getByRole('link', { name: /kitchen remodel/i }))

      expect(await screen.findByRole('heading', { name: 'Kitchen remodel' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Design notes' })).not.toBeInTheDocument()
    })
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
