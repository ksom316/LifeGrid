import { useMemo, useState } from 'react'
import { useAppData } from '../../state/AppDataContext'
import { parseDate } from '../../utils/date'
import { SESSION_TYPE_LABEL, sessionStatus, sessionType } from '../../utils/focusTimer'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { Field, inputClasses } from '../ui/Field'
import { IconSearch, IconTimer } from '../ui/icons'

const STATUS_TONE = {
  completed: 'success',
  interrupted: 'warning',
  active: 'brand',
  paused: 'warning',
} as const

function formatTimeOfDay(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatSessionDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function SessionHistoryList() {
  const { focusSessions, projects, tasks } = useAppData()
  const [projectFilter, setProjectFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const finishedSessions = useMemo(
    () =>
      focusSessions
        .filter((s) => sessionStatus(s) === 'completed' || sessionStatus(s) === 'interrupted')
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)),
    [focusSessions],
  )

  const filtered = finishedSessions.filter((session) => {
    const matchesProject = projectFilter === 'all' || session.projectId === projectFilter
    const startedAt = parseDate(session.startedAt)
    const matchesFrom = !fromDate || startedAt >= parseDate(fromDate)
    const matchesTo = !toDate || startedAt <= parseDate(toDate)
    return matchesProject && matchesFrom && matchesTo
  })

  const clearFilters = () => {
    setProjectFilter('all')
    setFromDate('')
    setToDate('')
  }

  return (
    <div className="flex flex-col gap-4">
      {finishedSessions.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end">
          {projects.length > 0 && (
            <div className="sm:w-48">
              <Field label="Project">
                <select
                  className={inputClasses}
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  aria-label="Filter sessions by project"
                >
                  <option value="all">All projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <div className="sm:w-40">
            <Field label="From">
              <input
                type="date"
                className={inputClasses}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="Filter sessions from date"
              />
            </Field>
          </div>
          <div className="sm:w-40">
            <Field label="To">
              <input
                type="date"
                className={inputClasses}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="Filter sessions to date"
              />
            </Field>
          </div>
        </div>
      )}

      {finishedSessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12">
          <EmptyState
            icon={<IconTimer width={32} height={32} />}
            title="No focus sessions yet"
            description="Completed and ended sessions will show up here."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12">
          <EmptyState
            icon={<IconSearch width={32} height={32} />}
            title="No sessions match your filters"
            description="Try a different date range or project."
            action={
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-medium text-brand-ink hover:underline"
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((session) => {
            const project = projects.find((p) => p.id === session.projectId)
            const task = tasks.find((t) => t.id === session.taskId)
            const type = sessionType(session)
            const status = sessionStatus(session)
            return (
              <li
                key={session.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={type === 'focus' ? 'brand' : 'neutral'}>{SESSION_TYPE_LABEL[type]}</Badge>
                  <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                  <span className="text-sm text-ink">
                    {formatSessionDate(session.startedAt)} · {formatTimeOfDay(session.startedAt)}
                    {session.endedAt && ` – ${formatTimeOfDay(session.endedAt)}`}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <span className="font-medium text-ink">{session.durationMinutes} min</span>
                  {session.projectId && <span>{project ? project.name : 'Deleted project'}</span>}
                  {session.taskId && <span>{task ? task.title : 'Deleted task'}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
