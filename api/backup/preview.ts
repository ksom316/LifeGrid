import type { VercelRequest, VercelResponse } from '@vercel/node'
import { previewRestore, validateBackup } from '../../src/data/backupValidation.ts'
import { badRequest, readJsonBody, requireMethod, withAuth } from '../../server/http.ts'
import { asRecord, requireEnum } from '../../server/validation.ts'
import { exportBackup } from '../../server/repositories/backup.ts'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['POST'])) return
  const body = asRecord(readJsonBody(req), 'Request body')
  const strategy = requireEnum(body.strategy, 'strategy', ['merge', 'replace'] as const)

  const validation = validateBackup(body.backup)
  if (!validation.valid || !validation.backup) {
    badRequest(`Invalid backup: ${validation.errors.join(' ')}`)
    return
  }

  const current = await exportBackup(sql, user.id, true)
  const counts = previewRestore(validation.backup, strategy, current.data)
  // Known limitation: previewRestore only compares against the current
  // user's own records (by design — it's the same pure, DB-free function
  // the local app uses), so it can't foresee the rare case where an
  // incoming record's id belongs to a *different* account. In that case
  // this preview can overstate "added" by that count. It's a display-only
  // gap, not a safety one: the actual restore endpoint (restoreBackupForUser)
  // independently detects and skips any such record regardless of what
  // this preview predicted — see partitionByForeignConflict in
  // server/repositories/backup.ts.
  res.status(200).json({ counts, warnings: validation.warnings })
})
