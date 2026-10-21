import { api } from '../../lib/apiClient'
import type { LifeGridBackup, RestoreCounts, RestoreResult, RestoreStrategy } from '../../types/backup'

export const remoteBackupRepo = {
  async export(includeDemoData: boolean): Promise<LifeGridBackup> {
    return api.get<LifeGridBackup>(`/api/backup/export?includeDemoData=${includeDemoData}`)
  },
  async preview(backup: LifeGridBackup, strategy: RestoreStrategy): Promise<{ counts: RestoreCounts; warnings: string[] }> {
    return api.post('/api/backup/preview', { backup, strategy })
  },
  async restore(backup: LifeGridBackup, strategy: RestoreStrategy): Promise<RestoreResult> {
    return api.post('/api/backup/restore', { backup, strategy })
  },
  async importLocal(backup: LifeGridBackup, strategy: RestoreStrategy): Promise<RestoreResult & { alreadyImported: boolean }> {
    return api.post('/api/backup/local-import', { backup, strategy })
  },
  async clearRealData(): Promise<void> {
    await api.post('/api/data/clear')
  },
}
