import { useMemo, useState } from 'react'
import { notePinned } from '../data/notes'
import { useAppData } from '../state/AppDataContext'
import type { Note } from '../types/domain'
import { NoteCard } from '../components/notes/NoteCard'
import { NoteFormModal } from '../components/notes/NoteFormModal'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Field, inputClasses } from '../components/ui/Field'
import { IconBook, IconPlus, IconSearch } from '../components/ui/icons'

type TagFilter = 'all' | string
type SortOption = 'updated' | 'created' | 'title'

const SORT_LABELS: Record<SortOption, string> = {
  updated: 'Recently updated',
  created: 'Recently created',
  title: 'Title',
}

function sortNotes(notes: Note[], sort: SortOption): Note[] {
  const sorted = [...notes]
  switch (sort) {
    case 'created':
      return sorted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'updated':
    default:
      return sorted.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }
}

export function KnowledgeVaultPage() {
  const { status, error, notes, projects, refresh } = useAppData()
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<TagFilter>('all')
  const [sort, setSort] = useState<SortOption>('updated')
  const [isCreateOpen, setCreateOpen] = useState(false)

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [notes])

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = notes.filter((note) => {
      const matchesQuery =
        !query ||
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      const matchesTag = tagFilter === 'all' || note.tags.includes(tagFilter)
      return matchesQuery && matchesTag
    })
    const sorted = sortNotes(filtered, sort)
    // Pinned notes always float to the top, preserving the chosen sort within each group.
    return [...sorted].sort((a, b) => Number(notePinned(b)) - Number(notePinned(a)))
  }, [notes, search, tagFilter, sort])

  const clearFilters = () => {
    setSearch('')
    setTagFilter('all')
  }

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-soft">
        Loading your notes…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-danger-soft bg-danger-soft px-6 py-10 text-center">
        <p className="text-sm font-medium text-danger">Life Grid couldn't load your notes.</p>
        {error && <p className="max-w-md text-xs text-ink-soft">{error}</p>}
        <Button variant="secondary" onClick={refresh}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Knowledge Vault</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Capture ideas, references, and research, and link them to your projects.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<IconPlus width={16} height={16} />}
          onClick={() => setCreateOpen(true)}
        >
          Create note
        </Button>
      </div>

      {notes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex-1 sm:min-w-[220px]">
            <Field label="Search">
              <div className="relative">
                <IconSearch
                  width={16}
                  height={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  className={`${inputClasses} pl-9`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or content"
                  aria-label="Search notes"
                />
              </div>
            </Field>
          </div>
          {allTags.length > 0 && (
            <div className="sm:w-40">
              <Field label="Tag">
                <select
                  className={inputClasses}
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  aria-label="Filter by tag"
                >
                  <option value="all">All tags</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <div className="sm:w-48">
            <Field label="Sort by">
              <select
                className={inputClasses}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort notes"
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                  <option key={option} value={option}>
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12">
          <EmptyState
            icon={<IconBook width={32} height={32} />}
            title="No notes yet"
            description="Create your first note to start capturing ideas, references, and research."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                Create note
              </Button>
            }
          />
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12">
          <EmptyState
            icon={<IconSearch width={32} height={32} />}
            title="No notes match your filters"
            description="Try a different search term or clear your filters to see all notes."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              project={projects.find((p) => p.id === note.projectId)}
              projects={projects}
            />
          ))}
        </div>
      )}

      <NoteFormModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} projects={projects} />
    </div>
  )
}
