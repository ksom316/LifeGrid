import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../../state/AppDataContext'
import { addDays, formatWeekRange, getWeekStart, parseDate, toDateKey } from '../../utils/date'
import { sessionStatus, sessionType } from '../../utils/focusTimer'
import { computeProjectTaskStats } from '../../utils/projectStats'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field, inputClasses } from '../ui/Field'
import { IconChevronLeft, IconChevronRight } from '../ui/icons'

function isWithinWeek(dateStr: string, weekStart: Date, weekEnd: Date): boolean {
  const date = parseDate(dateStr)
  return date >= weekStart && date <= weekEnd
}

export function WeeklyReviewPanel() {
  const { tasks, projects, focusSessions, weeklyReviews, upsertWeeklyReview } = useAppData()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const weekKey = toDateKey(weekStart)
  const weekEnd = addDays(weekStart, 6)
  const existingReview = weeklyReviews.find((r) => r.id === weekKey)

  // Seeded directly from already-loaded data (ReviewsTab only renders this
  // component once AppDataContext has finished loading), not via a
  // mount-time effect. An effect-based sync here previously raced a user
  // typing into the form immediately after mount: the effect could be
  // scheduled to run — and overwrite the field with its "initial" value —
  // *after* the keystroke's own state update, silently discarding it.
  // Lazy initializers run synchronously during the first render, so there's
  // no window for that race.
  const [wins, setWins] = useState(() => existingReview?.wins ?? '')
  const [blockers, setBlockers] = useState(() => existingReview?.blockers ?? '')
  const [lessons, setLessons] = useState(() => existingReview?.lessons ?? '')
  const [nextSteps, setNextSteps] = useState(() => existingReview?.nextSteps ?? '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Reloads the form only when the user navigates to a *different* week —
  // not on mount (handled above) and not on every data refresh — so saving
  // doesn't wipe its own "Saved." confirmation by resetting state when the
  // just-saved review comes back through context.
  const lastSyncedWeekKeyRef = useRef(weekKey)
  useEffect(() => {
    if (lastSyncedWeekKeyRef.current === weekKey) return
    lastSyncedWeekKeyRef.current = weekKey
    setWins(existingReview?.wins ?? '')
    setBlockers(existingReview?.blockers ?? '')
    setLessons(existingReview?.lessons ?? '')
    setNextSteps(existingReview?.nextSteps ?? '')
    setSaveState('idle')
  }, [weekKey, existingReview])

  const completedTasksThisWeek = tasks.filter(
    (t) => t.status === 'done' && t.completedAt && isWithinWeek(t.completedAt, weekStart, weekEnd),
  )
  const focusMinutesThisWeek = focusSessions
    .filter(
      (s) =>
        sessionType(s) === 'focus' &&
        sessionStatus(s) === 'completed' &&
        isWithinWeek(s.startedAt, weekStart, weekEnd),
    )
    .reduce((sum, s) => sum + s.durationMinutes, 0)

  const touchedProjectIds = new Set([
    ...completedTasksThisWeek.map((t) => t.projectId).filter((id): id is string => Boolean(id)),
    ...focusSessions
      .filter((s) => isWithinWeek(s.startedAt, weekStart, weekEnd))
      .map((s) => s.projectId)
      .filter((id): id is string => Boolean(id)),
  ])
  const touchedProjects = projects.filter((p) => touchedProjectIds.has(p.id))

  const handleSave = async () => {
    setSaveState('saving')
    await upsertWeeklyReview(weekKey, { wins, blockers, lessons, nextSteps })
    setSaveState('saved')
  }

  const isCurrentWeek = weekKey === toDateKey(getWeekStart(new Date()))

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekStart((d) => addDays(d, -7))}
          aria-label="Previous week"
          className="rounded-md p-1.5 text-ink-soft hover:bg-surface-hover hover:text-ink"
        >
          <IconChevronLeft width={18} height={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">{formatWeekRange(weekKey)}</p>
          {isCurrentWeek && <Badge tone="brand">Current week</Badge>}
        </div>
        <button
          type="button"
          onClick={() => setWeekStart((d) => addDays(d, 7))}
          aria-label="Next week"
          className="rounded-md p-1.5 text-ink-soft hover:bg-surface-hover hover:text-ink"
        >
          <IconChevronRight width={18} height={18} />
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 border-b border-border pb-5 sm:grid-cols-3">
        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums text-ink">{completedTasksThisWeek.length}</p>
          <p className="text-xs text-ink-soft">Tasks completed</p>
        </div>
        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums text-ink">{focusMinutesThisWeek}</p>
          <p className="text-xs text-ink-soft">Focus minutes</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-3xl font-bold tracking-tight tabular-nums text-ink">{touchedProjects.length}</p>
          <p className="text-xs text-ink-soft">Projects touched</p>
        </div>
      </div>

      {touchedProjects.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {touchedProjects.map((project) => {
            const stats = computeProjectTaskStats(tasks.filter((t) => t.projectId === project.id))
            return (
              <Badge key={project.id} tone="neutral">
                {project.name} · {stats.percent}%
              </Badge>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Wins & accomplishments">
          <textarea className={inputClasses} rows={3} value={wins} onChange={(e) => setWins(e.target.value)} />
        </Field>
        <Field label="Blockers & challenges">
          <textarea
            className={inputClasses}
            rows={3}
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
          />
        </Field>
        <Field label="Lessons learned">
          <textarea
            className={inputClasses}
            rows={3}
            value={lessons}
            onChange={(e) => setLessons(e.target.value)}
          />
        </Field>
        <Field label="Priorities for next week">
          <textarea
            className={inputClasses}
            rows={3}
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" onClick={handleSave} disabled={saveState === 'saving'}>
          {existingReview ? 'Update review' : 'Save review'}
        </Button>
        {saveState === 'saved' && <span className="text-sm text-success">Saved.</span>}
      </div>

      {weeklyReviews.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-ink-soft">Past reviews</p>
          <div className="flex flex-wrap gap-1.5">
            {[...weeklyReviews]
              .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
              .map((review) => (
                <button
                  key={review.id}
                  type="button"
                  onClick={() => setWeekStart(parseDate(review.weekStart))}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    review.id === weekKey
                      ? 'bg-brand-soft text-brand-ink'
                      : 'bg-canvas text-ink-soft hover:text-ink'
                  }`}
                >
                  {formatWeekRange(review.id)}
                </button>
              ))}
          </div>
        </div>
      )}
    </Card>
  )
}
