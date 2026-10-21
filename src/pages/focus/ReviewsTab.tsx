import { TabNav } from '../../components/focus/TabNav'
import { WeeklyReviewPanel } from '../../components/focus/WeeklyReviewPanel'
import { Button } from '../../components/ui/Button'
import { useAppData } from '../../state/AppDataContext'

export function ReviewsTab() {
  const { status, error, refresh } = useAppData()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Focus & Reviews</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Run focus sessions, plan your day, and review your week.
        </p>
      </div>

      <TabNav />

      {status === 'loading' ? (
        <div className="flex h-64 items-center justify-center text-sm text-ink-soft">
          Loading…
        </div>
      ) : status === 'error' ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger-soft bg-danger-soft px-6 py-10 text-center">
          <p className="text-sm font-medium text-danger">Life Grid couldn't load your focus data.</p>
          {error && <p className="max-w-md text-xs text-ink-soft">{error}</p>}
          <Button variant="secondary" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : (
        <WeeklyReviewPanel />
      )}
    </div>
  )
}
