import { useState } from 'react'
import { Link } from 'react-router-dom'
import { notePinned } from '../../data/notes'
import { useAppData } from '../../state/AppDataContext'
import type { Note, Project } from '../../types/domain'
import { formatShortDate } from '../../utils/date'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ColorBadge } from '../ui/ColorSwatch'
import { IconFolder, IconPencil, IconPin, IconTrash } from '../ui/icons'
import { cardTintStyle, resolveProjectColor } from '../../utils/colors'
import { resolveNoteColor, resolveTagColor } from '../../utils/tags'
import { NoteFormModal } from './NoteFormModal'

interface NoteCardProps {
  note: Note
  project?: Project
  projects: Project[]
}

export function NoteCard({ note, project, projects }: NoteCardProps) {
  const { deleteNote, toggleNotePin, tagColors } = useAppData()
  const [isEditOpen, setEditOpen] = useState(false)
  const [isDeleteOpen, setDeleteOpen] = useState(false)
  const pinned = notePinned(note)
  const cardColor = resolveNoteColor(note, project, tagColors)

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-5 shadow-sm transition-colors hover:border-border-strong"
      style={cardTintStyle(cardColor)}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/vault/${note.id}`} className="min-w-0 flex-1 focus-visible:outline-none">
          <h3 className="truncate text-sm font-semibold text-ink hover:text-brand-ink">
            {note.title}
          </h3>
        </Link>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => toggleNotePin(note.id)}
            aria-label={pinned ? `Unpin "${note.title}"` : `Pin "${note.title}"`}
            aria-pressed={pinned}
            className={`rounded-md p-2 sm:p-1 hover:bg-brand-soft hover:text-brand-ink ${
              pinned ? 'text-brand' : 'text-ink-soft'
            }`}
          >
            <IconPin width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label={`Edit "${note.title}"`}
            className="rounded-md p-2 sm:p-1 text-ink-soft hover:bg-surface-hover hover:text-ink"
          >
            <IconPencil width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            aria-label={`Delete "${note.title}"`}
            className="rounded-md p-2 sm:p-1 text-ink-soft hover:bg-danger-soft hover:text-danger"
          >
            <IconTrash width={14} height={14} />
          </button>
        </div>
      </div>

      {note.content && (
        <p className="line-clamp-3 whitespace-pre-wrap text-xs text-ink-soft">{note.content}</p>
      )}

      {(note.tags.length > 0 || project) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {project && (
            <Link to={`/projects/${project.id}`} onClick={(e) => e.stopPropagation()}>
              <ColorBadge color={resolveProjectColor(project)} icon={<IconFolder width={10} height={10} />}>
                {project.name}
              </ColorBadge>
            </Link>
          )}
          {note.tags.map((tag) => (
            <ColorBadge key={tag} color={resolveTagColor(tagColors, tag)}>
              {tag}
            </ColorBadge>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-soft">Updated {formatShortDate(note.updatedAt)}</p>

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
          setDeleteOpen(false)
        }}
      />
    </div>
  )
}
