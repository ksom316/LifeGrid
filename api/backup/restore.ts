import type { VercelRequest, VercelResponse } from '@vercel/node'
import { validateBackup } from '../../src/data/backupValidation.js'
import { badRequest, readJsonBody, requireMethod, withAuth } from '../../server/http.js'
import { asRecord, requireEnum } from '../../server/validation.js'
import { restoreBackupForUser } from '../../server/repositories/backup.js'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['POST'])) return
  const body = asRecord(readJsonBody(req), 'Request body')
  const strategy = requireEnum(body.strategy, 'strategy', ['merge', 'replace'] as const)

  const validation = validateBackup(body.backup)
  if (!validation.valid || !validation.backup) {
    badRequest(`Invalid backup: ${validation.errors.join(' ')}`)
    return
  }

  const result = await restoreBackupForUser(sql, user.id, validation.backup, strategy)
  res.status(200).json(result)
})
