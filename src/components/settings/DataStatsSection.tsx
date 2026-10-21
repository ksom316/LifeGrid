import { useAppData } from '../../state/AppDataContext'
import { Card } from '../ui/Card'

const ROWS: { key: 'projects' | 'tasks' | 'notes' | 'focusSessions' | 'dailyPlans' | 'weeklyReviews'; label: string }[] = [
  { key: 'projects', label: 'Projects' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notes', label: 'Notes' },
  { key: 'focusSessions', label: 'Focus sessions' },
  { key: 'dailyPlans', label: 'Daily plans' },
  { key: 'weeklyReviews', label: 'Weekly reviews' },
]

export function DataStatsSection() {
  const { projects, tasks, notes, focusSessions, dailyPlans, weeklyReviews } = useAppData()
  const byKey = { projects, tasks, notes, focusSessions, dailyPlans, weeklyReviews }

  return (
    <Card title="Data statistics">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {ROWS.map(({ key, label }) => {
          const records = byKey[key]
          const real = records.filter((r) => !r.isDemo).length
          const demo = records.length - real
          return (
            <div key={key}>
              <p className="text-3xl font-bold tracking-tight tabular-nums text-ink">{real}</p>
              <p className="text-xs text-ink-soft">
                {label}
                {demo > 0 && <span className="text-muted"> (+{demo} sample)</span>}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
