import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { focusSessionsRepo } from '../data/focusSessions'
import { notePinned, notesRepo } from '../data/notes'
import { projectsRepo } from '../data/projects'
import { tasksRepo } from '../data/tasks'
import { renderVaultApp } from '../test/testUtils'

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

describe('NoteDetailPage', () => {
  it('shows a not-found state with a link back for a missing note id', async () => {
    renderVaultApp('/vault/does-not-exist')

    expect(await screen.findByText('Note not found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to knowledge vault/i })).toBeInTheDocument()
  })

  it('renders the full note content with line breaks preserved as text, not HTML', async () => {
    const note = await notesRepo.create({
      title: 'Trip itinerary',
      content: 'Day 1: arrive\nDay 2: <b>explore</b>',
      tags: ['travel'],
    })

    renderVaultApp(`/vault/${note.id}`)

    expect(await screen.findByRole('heading', { name: 'Trip itinerary' })).toBeInTheDocument()
    expect(screen.getByText('travel')).toBeInTheDocument()
    // The raw tag text should appear as literal text, never parsed as an element.
    expect(screen.getByText(/explore/)).toBeInTheDocument()
    expect(screen.queryByRole('strong')).not.toBeInTheDocument()
    expect(document.querySelector('b')).toBeNull()
  })

  it('toggles pin state and reflects it immediately', async () => {
    const note = await notesRepo.create({ title: 'Pin candidate' })

    renderVaultApp(`/vault/${note.id}`)
    await screen.findByRole('heading', { name: 'Pin candidate' })

    fireEvent.click(screen.getByRole('button', { name: /^pin$/i }))

    await waitFor(async () => {
      const updated = await notesRepo.get(note.id)
      expect(notePinned(updated!)).toBe(true)
    })
    expect(await screen.findByRole('button', { name: /^unpin$/i })).toBeInTheDocument()
  })

  it('edits note details and persists the change after reload semantics', async () => {
    const note = await notesRepo.create({ title: 'Draft', content: 'first draft' })

    renderVaultApp(`/vault/${note.id}`)
    await screen.findByRole('heading', { name: 'Draft' })

    fireEvent.click(screen.getByRole('button', { name: /edit note/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Content'), {
      target: { value: 'final draft' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('final draft')).toBeInTheDocument()

    const stored = await notesRepo.get(note.id)
    expect(stored?.content).toBe('final draft')
  })

  it('links and unlinks a note from a project through the editor', async () => {
    const project = await projectsRepo.create({ name: 'Home office' })
    const note = await notesRepo.create({ title: 'Setup notes' })

    renderVaultApp(`/vault/${note.id}`)
    await screen.findByRole('heading', { name: 'Setup notes' })

    fireEvent.click(screen.getByRole('button', { name: /edit note/i }))
    let dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Project (optional)'), {
      target: { value: project.id },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(await screen.findByRole('link', { name: /home office/i })).toBeInTheDocument()
    expect((await notesRepo.get(note.id))?.projectId).toBe(project.id)

    fireEvent.click(screen.getByRole('button', { name: /edit note/i }))
    dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Project (optional)'), {
      target: { value: '' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(screen.queryByRole('link', { name: /home office/i })).not.toBeInTheDocument()
    expect((await notesRepo.get(note.id))?.projectId).toBeUndefined()
  })

  it('deletes a note while leaving other notes intact', async () => {
    const keep = await notesRepo.create({ title: 'Keep me' })
    const remove = await notesRepo.create({ title: 'Remove me' })

    renderVaultApp(`/vault/${remove.id}`)
    await screen.findByRole('heading', { name: 'Remove me' })

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /delete note/i }))

    expect(await screen.findByText('Knowledge Vault')).toBeInTheDocument()
    expect(await notesRepo.get(remove.id)).toBeUndefined()
    expect(await notesRepo.get(keep.id)).toBeDefined()
  })

  it('shows a project-deleted note as unassigned rather than broken', async () => {
    const project = await projectsRepo.create({ name: 'Temporary project' })
    const note = await notesRepo.create({ title: 'Survivor note', projectId: project.id })

    await projectsRepo.deletePreservingRecords(project.id)

    renderVaultApp(`/vault/${note.id}`)

    expect(await screen.findByRole('heading', { name: 'Survivor note' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /temporary project/i })).not.toBeInTheDocument()
    expect((await notesRepo.get(note.id))?.projectId).toBeUndefined()
  })
})
