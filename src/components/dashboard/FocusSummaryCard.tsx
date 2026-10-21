import { Link } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import { computeFocusStats } from '../../utils/focusStats'
import { sessionStatus, sessionType } from '../../utils/focusTimer'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { IconTimer } from '../ui/icons'

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
          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-border-strong hover:text-ink"
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
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-4">
            <div>
              <p className="text-4xl font-bold tracking-tight tabular-nums text-ink">
                {stats.todayMinutes}
              </p>
              <p className="text-xs text-ink-soft">minutes focused today</p>
            </div>
          </div>
          {mostRecent && (
            <p className="text-xs text-ink-soft">
              Last session: {mostRecent.durationMinutes} min
              {mostRecentProject && ` on ${mostRecentProject.name}`}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
