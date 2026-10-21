import { AccountSection } from '../components/settings/AccountSection'
import { DangerZoneSection } from '../components/settings/DangerZoneSection'
import { DataStatsSection } from '../components/settings/DataStatsSection'
import { ExportSection } from '../components/settings/ExportSection'
import { RestoreSection } from '../components/settings/RestoreSection'
import { Button } from '../components/ui/Button'
import { useAppData } from '../state/AppDataContext'

export function SettingsPage() {
  const { status, error, refresh, dataSource } = useAppData()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Settings</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          {dataSource === 'hosted'
            ? 'Your data syncs through your hosted Life Grid account. Use backups below as an independent safety copy.'
            : 'Your data is stored only in this browser — it is not automatically synchronised to any other device or account. Use backups below to move it or keep it safe.'}
        </p>
      </div>

      <AccountSection />

      {status === 'loading' ? (
        <div className="flex h-64 items-center justify-center text-sm text-ink-soft">Loading…</div>
      ) : status === 'error' ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger-soft bg-danger-soft px-6 py-10 text-center">
          <p className="text-sm font-medium text-danger">Life Grid couldn't load your data.</p>
          {error && <p className="max-w-md text-xs text-ink-soft">{error}</p>}
          <Button variant="secondary" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <DataStatsSection />
          <ExportSection />
          <RestoreSection />
          <DangerZoneSection />
        </div>
      )}
    </div>
  )
}
