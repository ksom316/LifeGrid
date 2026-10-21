import { useAppData } from '../../state/AppDataContext'
import { computeFocusStats } from '../../utils/focusStats'
import { formatMinutes } from '../../utils/focusTimer'
import { Card } from '../ui/Card'

export function FocusStatsPanel() {
  const { focusSessions, projects } = useAppData()
  const stats = computeFocusStats(focusSessions)
  const maxProjectMinutes = stats.byProject[0]?.minutes ?? 0

  return (
    <Card title="Focus stats">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Today" value={formatMinutes(stats.todayMinutes)} />
        <Stat label="This week" value={formatMinutes(stats.weekMinutes)} />
        <Stat label="Completed sessions" value={String(stats.completedCount)} />
        <Stat label="Average length" value={formatMinutes(stats.averageMinutes)} />
      </div>

      {stats.byProject.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-ink-soft">Focus time by project</p>
          <div className="flex flex-col gap-2">
            {stats.byProject.map(({ projectId, minutes }) => {
              const project = projects.find((p) => p.id === projectId)
              const percent = maxProjectMinutes === 0 ? 0 : Math.round((minutes / maxProjectMinutes) * 100)
              return (
                <div key={projectId}>
                  <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
                    <span className="truncate">{project?.name ?? 'Deleted project'}</span>
                    <span>{formatMinutes(minutes)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-canvas">
                    <div
                      className="h-1.5 rounded-full bg-brand transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-3xl font-bold tracking-tight tabular-nums text-ink">{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  )
}
