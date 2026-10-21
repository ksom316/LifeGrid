import { Link } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import { computeFocusStats } from '../../utils/focusStats'
import { sessionStatus, sessionType } from '../../utils/focusTimer'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { IconTimer } from '../ui/icons'

// The dial fills over two hours of focus; it's a visual scale, not a stored goal.
const DAILY_RING_MINUTES = 120
const CIRCUMFERENCE = 2 * Math.PI * 52

export function FocusSummaryCard() {
  const { focusSessions, projects } = useAppData()
  const stats = computeFocusStats(focusSessions)

  const mostRecent = [...focusSessions]
    .filter((s) => sessionType(s) === 'focus' && sessionStatus(s) === 'completed')
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0]
  const mostRecentProject = mostRecent && projects.find((p) => p.id === mostRecent.projectId)

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <IconTimer width={14} height={14} className="text-brand-ink" />
          Focus today
        </span>
      }
      action={
        <Link
          to="/focus"
          className="rounded-lg border border-border bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-border-strong hover:text-ink"
        >
          Open timer
        </Link>
      }
    >
      {stats.todayMinutes === 0 && !mostRecent ? (
        <EmptyState
          icon={<IconTimer width={28} height={28} />}
          title="No focus sessions logged today"
          description="Start a focus session to track deep work."
        />
      ) : (
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative flex items-center justify-center">
            <svg className="h-32 w-32" viewBox="0 0 128 128" aria-hidden="true">
              <circle className="text-canvas" strokeWidth="6" stroke="currentColor" fill="transparent" r="52" cx="64" cy="64" />
              <circle
                className="progress-ring-circle text-brand"
                strokeWidth="6"
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="52"
                cx="64"
                cy="64"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(stats.todayMinutes / DAILY_RING_MINUTES, 1))}
              />
            </svg>
            <div className="absolute text-center">
              <p className="font-mono text-2xl font-bold tracking-tight tabular-nums text-ink">
                {stats.todayMinutes}
              </p>
              <p className="text-[10px] text-ink-soft">minutes today</p>
            </div>
          </div>
          {mostRecent && (
            <p className="text-center text-[11px] text-ink-soft">
              Last session: {mostRecent.durationMinutes} min
              {mostRecentProject && ` on ${mostRecentProject.name}`}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
