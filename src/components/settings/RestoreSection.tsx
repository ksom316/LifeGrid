import { useMemo, useRef, useState } from 'react'
import { createBackup, previewRestore, validateBackup } from '../../data/backup'
import { useAppData } from '../../state/AppDataContext'
import type { BackupData, LifeGridBackup, RestoreCounts, RestoreStrategy } from '../../types/backup'
import { backupFilename, downloadJson } from '../../utils/downloadFile'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { IconDownload, IconUpload } from '../ui/icons'

const STORE_LABELS: Record<keyof BackupData, string> = {
  projects: 'Projects',
  tasks: 'Tasks',
  notes: 'Notes',
  focusSessions: 'Focus sessions',
  dailyPlans: 'Daily plans',
  weeklyReviews: 'Weekly reviews',
}

type Stage = 'idle' | 'error' | 'preview' | 'restoring' | 'done'

export function RestoreSection() {
  const appData = useAppData()
  const { restoreFromBackup } = appData
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [backup, setBackup] = useState<LifeGridBackup | null>(null)
  const [strategy, setStrategy] = useState<RestoreStrategy>('merge')
  const [hasSafetyBackup, setHasSafetyBackup] = useState(false)
  const [resultCounts, setResultCounts] = useState<RestoreCounts | null>(null)

  const currentData: BackupData = useMemo(
    () => ({
      projects: appData.projects,
      tasks: appData.tasks,
      notes: appData.notes,
      focusSessions: appData.focusSessions,
      dailyPlans: appData.dailyPlans,
      weeklyReviews: appData.weeklyReviews,
    }),
    [appData.projects, appData.tasks, appData.notes, appData.focusSessions, appData.dailyPlans, appData.weeklyReviews],
  )

  const preview = backup ? previewRestore(backup, strategy, currentData) : null

  const resetToIdle = () => {
    setStage('idle')
    setErrors([])
    setWarnings([])
    setBackup(null)
    setStrategy('merge')
    setHasSafetyBackup(false)
    setResultCounts(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setHasSafetyBackup(false)
    setResultCounts(null)

    let parsed: unknown
    try {
      const text = await file.text()
      parsed = JSON.parse(text)
    } catch {
      setBackup(null)
      setErrors(['The selected file is not valid JSON.'])
      setWarnings([])
      setStage('error')
      return
    }

    const result = validateBackup(parsed)
    if (!result.valid || !result.backup) {
      setBackup(null)
      setErrors(result.errors)
      setWarnings(result.warnings)
      setStage('error')
      return
    }

    setBackup(result.backup)
    setErrors([])
    setWarnings(result.warnings)
    setStage('preview')
  }

  const handleDownloadSafetyBackup = async () => {
    const current = await createBackup({ includeDemoData: true })
    downloadJson(backupFilename(), current)
    setHasSafetyBackup(true)
  }

  const handleRestore = async () => {
    if (!backup) return
    setStage('restoring')
    try {
      const result = await restoreFromBackup(backup, strategy)
      setResultCounts(result.counts)
      setStage('done')
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'The restore failed unexpectedly. Your existing data was not changed.'])
      setStage('error')
    }
  }

  return (
    <Card title="Restore from backup">
      <p className="mb-4 text-sm text-ink-soft">
        Select a Life Grid backup file (<code className="text-ink">.json</code>) to restore. Nothing
        is changed until you review a preview and confirm.
      </p>

      {stage !== 'preview' && stage !== 'restoring' && stage !== 'done' && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<IconUpload width={16} height={16} />}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose backup file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Choose a Life Grid backup file"
          />
        </div>
      )}

      {stage === 'error' && errors.length > 0 && (
        <div className="mt-4 rounded-lg border border-danger-soft bg-danger-soft p-3">
          <p className="mb-1 text-sm font-medium text-danger">This backup couldn't be used:</p>
          <ul className="list-inside list-disc text-sm text-danger">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {stage === 'preview' && backup && preview && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-canvas p-3 text-xs text-ink-soft">
            Exported {new Date(backup.exportedAt).toLocaleString()}
            {backup.includesDemoData ? ' · includes sample data' : ' · real data only'}
          </div>

          {warnings.length > 0 && (
            <div className="rounded-lg border border-warning-soft bg-warning-soft p-3">
              <ul className="list-inside list-disc text-sm text-warning">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">Restore strategy</legend>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name="restore-strategy"
                checked={strategy === 'merge'}
                onChange={() => setStrategy('merge')}
                className="mt-0.5 accent-brand"
              />
              <span>
                <strong>Merge</strong> — add new records and update ones that are newer in the backup.
                A sample-data record never overwrites a real one. Unrelated existing data is kept.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name="restore-strategy"
                checked={strategy === 'replace'}
                onChange={() => setStrategy('replace')}
                className="mt-0.5 accent-brand"
              />
              <span>
                <strong>Replace</strong> — delete all current data (including any sample data) and
                replace it with exactly what's in the backup. This can't be undone.
              </span>
            </label>
          </fieldset>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas text-xs text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Store</th>
                  <th className="px-3 py-2 font-medium">Added</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                  <th className="px-3 py-2 font-medium">Unchanged</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(STORE_LABELS) as (keyof BackupData)[]).map((key) => (
                  <tr key={key} className="border-t border-border">
                    <td className="px-3 py-1.5 text-ink">{STORE_LABELS[key]}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{preview[key].added}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{preview[key].updated}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{preview[key].skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {strategy === 'replace' && (
            <div className="rounded-lg border border-danger-soft bg-danger-soft p-3">
              <p className="mb-2 text-sm text-danger">
                Replace permanently deletes your current data first. Download a safety copy of your
                current data before continuing.
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<IconDownload width={14} height={14} />}
                onClick={handleDownloadSafetyBackup}
              >
                {hasSafetyBackup ? 'Safety backup downloaded ✓' : 'Download current data now'}
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetToIdle}>
              Cancel
            </Button>
            <Button
              variant={strategy === 'replace' ? 'danger' : 'primary'}
              className={strategy === 'replace' ? '!bg-red-600 !text-white hover:!bg-red-700' : ''}
              onClick={handleRestore}
              disabled={strategy === 'replace' && !hasSafetyBackup}
            >
              {strategy === 'replace' ? 'Replace data' : 'Merge backup'}
            </Button>
          </div>
        </div>
      )}

      {stage === 'restoring' && <p className="mt-4 text-sm text-ink-soft">Restoring…</p>}

      {stage === 'done' && resultCounts && (
        <div className="mt-4 rounded-lg border border-success-soft bg-success-soft p-3">
          <p className="mb-2 text-sm font-medium text-success">Restore complete.</p>
          <ul className="text-sm text-success">
            {(Object.keys(STORE_LABELS) as (keyof BackupData)[]).map((key) => {
              const c = resultCounts[key]
              if (c.added === 0 && c.updated === 0) return null
              return (
                <li key={key}>
                  {STORE_LABELS[key]}:{' '}
                  {[c.added > 0 && `${c.added} added`, c.updated > 0 && `${c.updated} updated`]
                    .filter(Boolean)
                    .join(', ')}
                </li>
              )
            })}
          </ul>
          <Button variant="secondary" size="sm" className="mt-3" onClick={resetToIdle}>
            Restore another backup
          </Button>
        </div>
      )}

    </Card>
  )
}
