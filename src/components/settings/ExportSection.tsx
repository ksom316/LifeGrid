import { useId, useState } from 'react'
import { createBackup } from '../../data/backup'
import { remoteBackupRepo } from '../../data/remote/backup'
import { useAppData } from '../../state/AppDataContext'
import { backupFilename, downloadJson } from '../../utils/downloadFile'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { IconDownload } from '../ui/icons'

export function ExportSection() {
  const { dataSource } = useAppData()
  const [includeDemoData, setIncludeDemoData] = useState(false)
  const [status, setStatus] = useState<'idle' | 'exporting' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const checkboxId = useId()

  const handleExport = async () => {
    setStatus('exporting')
    setError(null)
    try {
      // Exports whichever data is actually active right now — the hosted
      // account's data when signed in, local IndexedDB otherwise — so the
      // downloaded file always matches what the rest of the app is showing.
      const backup =
        dataSource === 'hosted' ? await remoteBackupRepo.export(includeDemoData) : await createBackup({ includeDemoData })
      downloadJson(backupFilename(), backup)
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The export failed unexpectedly.')
      setStatus('error')
    }
  }

  return (
    <Card title="Backup & export">
      <p className="mb-4 text-sm text-ink-soft">
        Download a complete copy of your data as a JSON file. Nothing is sent anywhere — the file is
        generated and saved entirely in your browser.
      </p>
      <label className="mb-4 flex items-center gap-2 text-sm text-ink">
        <input
          id={checkboxId}
          type="checkbox"
          checked={includeDemoData}
          onChange={(e) => setIncludeDemoData(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-brand"
        />
        Include sample data in the export
      </label>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <Button
        variant="primary"
        icon={<IconDownload width={16} height={16} />}
        onClick={handleExport}
        disabled={status === 'exporting'}
      >
        {status === 'exporting' ? 'Preparing backup…' : 'Download backup'}
      </Button>
    </Card>
  )
}
