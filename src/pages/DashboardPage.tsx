import { DemoDataBanner } from '../components/dashboard/DemoDataBanner'
import { DeadlinesCard } from '../components/dashboard/DeadlinesCard'
import { FocusSummaryCard } from '../components/dashboard/FocusSummaryCard'
import { GreetingHeader } from '../components/dashboard/GreetingHeader'
import { PrioritiesCard } from '../components/dashboard/PrioritiesCard'
import { ProjectsOverviewCard } from '../components/dashboard/ProjectsOverviewCard'
import { QuickActions } from '../components/dashboard/QuickActions'
import { RecentNotesCard } from '../components/dashboard/RecentNotesCard'
import { UnassignedTasksCard } from '../components/dashboard/UnassignedTasksCard'
import { Button } from '../components/ui/Button'
import { useAppData } from '../state/AppDataContext'

export function DashboardPage() {
  const { status, error, isEmpty, loadSampleData, refresh, dataSource } = useAppData()

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-soft">
        Loading your data…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger-soft bg-danger-soft px-6 py-10 text-center">
        <p className="text-sm font-medium text-danger">
          Life Grid couldn't load your data.
        </p>
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
        <GreetingHeader />
        <QuickActions />
      </div>

      <DemoDataBanner />

      {isEmpty && (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
          <p className="text-sm font-medium text-ink">Your dashboard is empty</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">
            Add your first task, project, or note above
            {dataSource === 'local' && ' — or explore Life Grid with a small set of sample data you can remove at any time'}.
          </p>
          {dataSource === 'local' && (
            <Button className="mt-5" variant="primary" onClick={loadSampleData}>
              Load sample data
            </Button>
          )}
        </div>
      )}

      {/*
        Exactly six cards in a two-column grid — three full, evenly matched
        rows with no dangling cell. FocusSummaryCard previously spanned both
        columns on its own row, which left an empty cell beside
        UnassignedTasksCard above it; letting it flow naturally pairs them
        instead.
      */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PrioritiesCard />
        <DeadlinesCard />
        <ProjectsOverviewCard />
        <RecentNotesCard />
        <UnassignedTasksCard />
        <FocusSummaryCard />
      </div>
    </div>
  )
}
