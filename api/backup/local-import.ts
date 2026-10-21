import type { VercelRequest, VercelResponse } from '@vercel/node'
import { validateBackup } from '../../src/data/backupValidation.ts'
import { badRequest, readJsonBody, requireMethod, withAuth } from '../../server/http.ts'
import { asRecord, requireEnum } from '../../server/validation.ts'
import { importLocalBackup } from '../../server/repositories/migration.ts'

/**
 * The commit step of the "safe migration of existing local data" onboarding
 * flow: the browser has already exported its IndexedDB data as a
 * LifeGridBackup (the same JSON format Settings > backup produces) and the
 * user has explicitly confirmed importing it after previewing it client-side
 * — this endpoint never runs on its own. Re-uploading the same exported
 * snapshot a second time is a safe no-op (see fingerprintBackup in
 * server/repositories/migration.ts), so an accidental double-submit from the
 * onboarding UI can't duplicate records.
 */
export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['POST'])) return
  const body = asRecord(readJsonBody(req), 'Request body')
  const strategy = requireEnum(body.strategy, 'strategy', ['merge', 'replace'] as const)

  const validation = validateBackup(body.backup)
  if (!validation.valid || !validation.backup) {
    badRequest(`Invalid backup: ${validation.errors.join(' ')}`)
    return
  }

  const result = await importLocalBackup(sql, user.id, validation.backup, strategy)
  res.status(200).json(result)
})
