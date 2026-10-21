import { useMemo, useState } from 'react'
import { projectPriority } from '../data/projects'
import { useAppData } from '../state/AppDataContext'
import type { Project, ProjectPriority, ProjectStatus } from '../types/domain'
import { ProjectCard } from '../components/projects/ProjectCard'
import { ProjectFormModal } from '../components/projects/ProjectFormModal'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Field, inputClasses } from '../components/ui/Field'
import { IconFolder, IconPlus, IconSearch } from '../components/ui/icons'

type StatusFilter = 'all' | ProjectStatus
type PriorityFilter = 'all' | ProjectPriority
type SortOption = 'updated' | 'deadline' | 'priority' | 'name'

const STATUS_OPTIONS: StatusFilter[] = ['all', 'active', 'paused', 'completed', 'archived']
const PRIORITY_OPTIONS: PriorityFilter[] = ['all', 'high', 'medium', 'low']
const PRIORITY_ORDER: Record<ProjectPriority, number> = { high: 0, medium: 1, low: 2 }

const SORT_LABELS: Record<SortOption, string> = {
  updated: 'Recently updated',
  deadline: 'Deadline',
  priority: 'Priority',
  name: 'Name',
}

function sortProjects(projects: Project[], sort: SortOption): Project[] {
  const sorted = [...projects]
  switch (sort) {
    case 'deadline':
      return sorted.sort((a, b) => {
        if (!a.targetDate && !b.targetDate) return 0
        if (!a.targetDate) return 1
        if (!b.targetDate) return -1
        return a.targetDate < b.targetDate ? -1 : 1
      })
    case 'priority':
      return sorted.sort(
        (a, b) => PRIORITY_ORDER[projectPriority(a)] - PRIORITY_ORDER[projectPriority(b)],
      )
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'updated':
    default:
      return sorted.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }
}

export function ProjectsPage() {
  const { status, error, projects, tasks, refresh } = useAppData()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [sort, setSort] = useState<SortOption>('updated')
  const [isCreateOpen, setCreateOpen] = useState(false)

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = projects.filter((project) => {
      const matchesQuery =
        !query ||
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || projectPriority(project) === priorityFilter
      return matchesQuery && matchesStatus && matchesPriority
    })
    return sortProjects(filtered, sort)
  }, [projects, search, statusFilter, priorityFilter, sort])

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setPriorityFilter('all')
  }

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-soft">
        Loading your projects…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger-soft bg-danger-soft px-6 py-10 text-center">
        <p className="text-sm font-medium text-danger">Life Grid couldn't load your projects.</p>
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
          <h1 className="text-[1.75rem] font-bold tracking-tight text-ink">Projects</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Organise your work into projects and track their tasks in one place.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<IconPlus width={16} height={16} />}
          onClick={() => setCreateOpen(true)}
        >
          Create project
        </Button>
      </div>

      {projects.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end">
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
                  placeholder="Search by name or description"
                  aria-label="Search projects"
                />
              </div>
            </Field>
          </div>
          <div className="sm:w-40">
            <Field label="Status">
              <select
                className={inputClasses}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="sm:w-40">
            <Field label="Priority">
              <select
                className={inputClasses}
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                aria-label="Filter by priority"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p === 'all' ? 'All priorities' : p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="sm:w-48">
            <Field label="Sort by">
              <select
                className={inputClasses}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort projects"
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

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-12">
          <EmptyState
            icon={<IconFolder width={32} height={32} />}
            title="No projects yet"
            description="Create your first project to start grouping tasks, notes, and focus time."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                Create project
              </Button>
            }
          />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-12">
          <EmptyState
            icon={<IconSearch width={32} height={32} />}
            title="No projects match your filters"
            description="Try a different search term or clear your filters to see all projects."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              tasks={tasks.filter((t) => t.projectId === project.id)}
            />
          ))}
        </div>
      )}

      <ProjectFormModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
