import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { notePinned } from '../../data/notes'
import { useAppData } from '../../state/AppDataContext'
import type { Note, Project } from '../../types/domain'
import { formatShortDate } from '../../utils/date'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ColorBadge } from '../ui/ColorSwatch'
import { IconFolder, IconPencil, IconPin, IconPinFilled, IconTrash } from '../ui/icons'
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
  const navigate = useNavigate()
  const [isEditOpen, setEditOpen] = useState(false)
  const [isDeleteOpen, setDeleteOpen] = useState(false)
  const pinned = notePinned(note)
  const cardColor = resolveNoteColor(note, project, tagColors)
  const detailPath = `/vault/${note.id}`

  const openDetail = () => navigate(detailPath)

  // The card itself is the click target (not an inner <Link>), so nested
  // real interactive elements — the pin/edit/delete buttons, the project
  // badge link — never end up nested inside another interactive element.
  // They opt out of card navigation by calling stopPropagation on their own
  // click, which is also how keyboard activation (Enter/Space on a focused
  // <button> or <a> synthesizes a click) is covered for free.
  const handleCardClick = () => {
    // A text selection made by dragging across the card shouldn't also
    // navigate away once the mouse is released.
    if (window.getSelection()?.toString()) return
    openDetail()
  }

  // Only reacts when the card wrapper itself is the keydown target — a
  // nested button/link handles its own Enter/Space and would otherwise
  // cause this to double-fire as the keydown event bubbles up.
  const handleCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDetail()
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={note.title}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="flex cursor-pointer flex-col gap-3 rounded-xl border p-5 shadow-sm transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      style={cardTintStyle(cardColor)}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{note.title}</h3>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleNotePin(note.id)
            }}
            aria-label={pinned ? `Unpin "${note.title}"` : `Pin "${note.title}"`}
            aria-pressed={pinned}
            className={`rounded-md p-2 transition-colors sm:p-1 ${
              pinned
                ? 'border border-brand/25 bg-brand/10 text-brand-ink hover:bg-brand/20'
                : 'border border-transparent text-ink-soft hover:bg-brand-soft hover:text-brand-ink'
            }`}
          >
            {pinned ? <IconPinFilled width={14} height={14} /> : <IconPin width={14} height={14} />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setEditOpen(true)
            }}
            aria-label={`Edit "${note.title}"`}
            className="rounded-md p-2 sm:p-1 text-ink-soft hover:bg-surface-hover hover:text-ink"
          >
            <IconPencil width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteOpen(true)
            }}
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

      {/*
        Modal/ConfirmDialog render inline (no portal), so without this
        wrapper every click inside them — typing in a field, pressing Save —
        would bubble through the card's own onClick and navigate away while
        the dialog is still open. Only stopping click (not keydown) here:
        the card's own keydown handler already ignores anything that isn't
        targeted at the card directly, and stopping keydown propagation
        would also block Modal's document-level Escape-to-close listener,
        since React's stopPropagation() halts the underlying native event.
      */}
      <div onClick={(e) => e.stopPropagation()}>
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
    </div>
  )
}
