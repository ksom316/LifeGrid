import { useCallback, useEffect, useState } from 'react'
import { createBackup } from '../../data/backup'
import { remoteBackupRepo } from '../../data/remote/backup'
import { useAppData } from '../../state/AppDataContext'
import type { BackupData, LifeGridBackup, RestoreCounts } from '../../types/backup'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

const STORE_LABELS: Record<keyof BackupData, string> = {
  projects: 'Projects',
  tasks: 'Tasks',
  notes: 'Notes',
  focusSessions: 'Focus sessions',
  dailyPlans: 'Daily plans',
  weeklyReviews: 'Weekly reviews',
}

type Stage = 'loading' | 'empty' | 'preview' | 'importing' | 'done' | 'already-imported' | 'error'

interface LocalDataMigrationDialogProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * The "safe migration of existing local data" flow: read this browser's
 * IndexedDB data, preview exactly what importing it would do against the
 * signed-in account, and only import after explicit confirmation. Never
 * clears IndexedDB afterward — the local copy and the JSON export both
 * remain available as independent safety nets regardless of what happens
 * here.
 */
export function LocalDataMigrationDialog({ isOpen, onClose }: LocalDataMigrationDialogProps) {
  const { refresh } = useAppData()
  const [stage, setStage] = useState<Stage>('loading')
  const [backup, setBackup] = useState<LifeGridBackup | null>(null)
  const [counts, setCounts] = useState<RestoreCounts | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [resultCounts, setResultCounts] = useState<RestoreCounts | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStage('loading')
    try {
      // Demo/sample data is a local-only concept and is never part of a
      // hosted migration — importing it into a real account would plant
      // fake records there.
      const localBackup = await createBackup({ includeDemoData: false })
      const totalRecords = Object.values(localBackup.counts).reduce((sum, n) => sum + n, 0)
      if (totalRecords === 0) {
        setStage('empty')
        return
      }
      const preview = await remoteBackupRepo.preview(localBackup, 'merge')
      setBackup(localBackup)
      setCounts(preview.counts)
      setWarnings(preview.warnings)
      setStage('preview')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not read local data.')
      setStage('error')
    }
  }, [])

  // Loads fresh every time the dialog opens, since local data could have
  // changed (or the account could have) since it was last opened.
  useEffect(() => {
    if (isOpen) load()
  }, [isOpen, load])

  const handleClose = () => {
    onClose()
    // Reset for next time the dialog opens, after the close animation would
    // have room to run (there isn't one here, but keeping it simple).
    setStage('loading')
    setBackup(null)
    setCounts(null)
    setWarnings([])
    setResultCounts(null)
    setErrorMessage(null)
  }

  const handleImport = async () => {
    if (!backup) return
    setStage('importing')
    try {
      const result = await remoteBackupRepo.importLocal(backup, 'merge')
      if (result.alreadyImported) {
        setStage('already-imported')
      } else {
        setResultCounts(result.counts)
        setStage('done')
      }
      await refresh()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'The import failed unexpectedly. Your local data is untouched.')
      setStage('error')
    }
  }

  return (
    <Modal title="Import local data" isOpen={isOpen} onClose={handleClose}>
      {stage === 'loading' && <p className="text-sm text-ink-soft">Checking this browser for local data…</p>}

      {stage === 'empty' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            No local data was found in this browser to import — you're all set.
          </p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {stage === 'error' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-danger">{errorMessage}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
            <Button variant="secondary" onClick={load}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {stage === 'preview' && counts && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            This will add the local data below to your account. Nothing already in your account is
            overwritten unless the local copy is actually newer, and sample-data records never
            overwrite real ones.
          </p>

          {warnings.length > 0 && (
            <div className="rounded-lg border border-warning-soft bg-warning-soft p-3">
              <ul className="list-inside list-disc text-sm text-warning">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas text-xs text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Store</th>
                  <th className="px-3 py-2 font-medium">Will add</th>
                  <th className="px-3 py-2 font-medium">Will update</th>
                  <th className="px-3 py-2 font-medium">Unchanged</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(STORE_LABELS) as (keyof BackupData)[]).map((key) => (
                  <tr key={key} className="border-t border-border">
                    <td className="px-3 py-1.5 text-ink">{STORE_LABELS[key]}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{counts[key].added}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{counts[key].updated}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{counts[key].skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleImport}>
              Import local data
            </Button>
          </div>
        </div>
      )}

      {stage === 'importing' && <p className="text-sm text-ink-soft">Importing…</p>}

      {stage === 'already-imported' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            This exact local data has already been imported into your account — nothing was changed.
          </p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {stage === 'done' && resultCounts && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-success">Import complete.</p>
          <ul className="text-sm text-ink-soft">
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
          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
