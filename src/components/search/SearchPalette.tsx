import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import type { SearchResult, SearchResultType } from '../../utils/search'
import { searchAll } from '../../utils/search'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { IconBook, IconFlag, IconFolder, IconSearch, IconX } from '../ui/icons'

interface SearchPaletteProps {
  isOpen: boolean
  onClose: () => void
}

const TYPE_ICON: Record<SearchResultType, typeof IconFolder> = {
  project: IconFolder,
  task: IconFlag,
  note: IconBook,
}

const TYPE_LABEL: Record<SearchResultType, string> = {
  project: 'Project',
  task: 'Task',
  note: 'Note',
}

export function SearchPalette({ isOpen, onClose }: SearchPaletteProps) {
  const { projects, tasks, notes } = useAppData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(
    () => searchAll({ projects, tasks, notes }, query),
    [projects, tasks, notes, query],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleSelect = (result: SearchResult) => {
    onClose()
    if (result.type === 'project') {
      navigate(`/projects/${result.id}`)
    } else if (result.type === 'note') {
      navigate(`/vault/${result.id}`)
    } else if (result.type === 'task') {
      // Life Grid has no standalone task route; a task's project detail page
      // is the most useful existing destination, and it highlights the
      // specific task. Unassigned tasks have no project page to go to, so
      // we fall back to the Dashboard, which already surfaces open tasks.
      navigate(result.projectId ? `/projects/${result.projectId}?task=${result.id}` : '/')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const result = results[activeIndex]
      if (result) handleSelect(result)
    }
  }

  const activeResult = results[activeIndex]

  return (
    <Modal title="Search" isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-xl">
      <div className="relative">
        <IconSearch
          width={16}
          height={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results-list"
          aria-autocomplete="list"
          aria-activedescendant={activeResult ? `search-result-${activeResult.type}-${activeResult.id}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search projects, tasks, and notes…"
          className="w-full rounded-lg border border-border bg-canvas py-2 pl-9 pr-9 text-sm text-ink placeholder:text-muted transition-colors focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-ink-soft hover:bg-surface-hover hover:text-ink"
          >
            <IconX width={14} height={14} />
          </button>
        )}
      </div>

      <div
        id="search-results-list"
        role="listbox"
        aria-label="Search results"
        ref={listRef}
        className="mt-3 max-h-80 overflow-y-auto"
      >
        {query.trim() === '' ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <IconSearch width={24} height={24} className="text-muted" />
            <p className="text-sm font-medium text-ink">Search your workspace</p>
            <p className="max-w-xs text-xs text-ink-soft">
              Find projects, tasks, and notes by name, description, content, or tag.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="text-sm font-medium text-ink">No results for "{query.trim()}"</p>
            <p className="max-w-xs text-xs text-ink-soft">Try a different word or check your spelling.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {results.map((result, index) => {
              const Icon = TYPE_ICON[result.type]
              const active = index === activeIndex
              return (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    id={`search-result-${result.type}-${result.id}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-active={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleSelect(result)}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      active ? 'bg-brand-soft' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <Icon width={16} height={16} className="mt-0.5 shrink-0 text-ink-soft" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-ink">{result.title}</span>
                        <Badge tone="neutral">{TYPE_LABEL[result.type]}</Badge>
                        {result.isDemo && <Badge tone="warning">Sample</Badge>}
                      </div>
                      {result.snippet && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft">{result.snippet}</p>
                      )}
                      {result.context.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-muted">{result.context.join(' · ')}</p>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
