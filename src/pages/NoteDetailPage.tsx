import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { notePinned } from '../data/notes'
import { useAppData } from '../state/AppDataContext'
import { NoteFormModal } from '../components/notes/NoteFormModal'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { IconArrowLeft, IconBook, IconFolder, IconPencil, IconPin, IconTrash } from '../components/ui/icons'
import { formatLongDate } from '../utils/date'

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { status, error, notes, projects, deleteNote, toggleNotePin, refresh } = useAppData()
  const [isEditOpen, setEditOpen] = useState(false)
  const [isDeleteOpen, setDeleteOpen] = useState(false)

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-soft">
        Loading note…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger-soft bg-danger-soft px-6 py-10 text-center">
        <p className="text-sm font-medium text-danger">Life Grid couldn't load this note.</p>
        {error && <p className="max-w-md text-xs text-ink-soft">{error}</p>}
        <Button variant="secondary" onClick={refresh}>
          Try again
        </Button>
      </div>
    )
  }

  const note = notes.find((n) => n.id === id)

  if (!note) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
        <IconBook width={32} height={32} className="text-muted" />
        <p className="text-sm font-medium text-ink">Note not found</p>
        <p className="max-w-sm text-sm text-ink-soft">
          This note may have been deleted, or the link is no longer valid.
        </p>
        <Button variant="secondary" onClick={() => navigate('/vault')}>
          Back to Knowledge Vault
        </Button>
      </div>
    )
  }

  const project = projects.find((p) => p.id === note.projectId)
  const pinned = notePinned(note)

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/vault"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
      >
        <IconArrowLeft width={16} height={16} />
        Back to Knowledge Vault
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[1.75rem] font-bold tracking-tight text-ink">{note.title}</h1>
            {pinned && <Badge tone="brand">Pinned</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {note.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
            {project && (
              <Link to={`/projects/${project.id}`}>
                <Badge tone="brand">
                  <IconFolder width={10} height={10} className="mr-1" />
                  {project.name}
                </Badge>
              </Link>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Updated {formatLongDate(note.updatedAt)} · Created {formatLongDate(note.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            icon={<IconPin width={16} height={16} />}
            onClick={() => toggleNotePin(note.id)}
            aria-pressed={pinned}
          >
            {pinned ? 'Unpin' : 'Pin'}
          </Button>
          <Button
            variant="secondary"
            icon={<IconPencil width={16} height={16} />}
            onClick={() => setEditOpen(true)}
          >
            Edit note
          </Button>
          <Button
            variant="danger"
            icon={<IconTrash width={16} height={16} />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        {note.content ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{note.content}</p>
        ) : (
          <p className="text-sm text-ink-soft">This note has no content yet.</p>
        )}
      </div>

      <NoteFormModal
        isOpen={isEditOpen}
        onClose={() => setEditOpen(false)}
        note={note}
        projects={projects}
      />
      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete note"
        message={`Delete "${note.title}"? This can't be undone.`}
        confirmLabel="Delete note"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteNote(note.id)
          navigate('/vault')
        }}
      />
    </div>
  )
}
