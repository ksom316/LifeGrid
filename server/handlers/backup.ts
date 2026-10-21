import type { VercelRequest, VercelResponse } from '@vercel/node'
import { previewRestore, validateBackup } from '../../src/data/backupValidation.js'
import type { AuthedContext } from '../http.js'
import { badRequest, requireMethod, readJsonBody } from '../http.js'
import { asRecord, requireEnum } from '../validation.js'
import { exportBackup, restoreBackupForUser } from '../repositories/backup.js'
import { importLocalBackup } from '../repositories/migration.js'

/** Bodies moved verbatim out of the former api/backup/{export,local-import,preview,restore}.ts. */

export async function handleExport(req: VercelRequest, res: VercelResponse, { sql, user }: AuthedContext): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return
  const includeDemoData = req.query.includeDemoData === 'true'
  const backup = await exportBackup(sql, user.id, includeDemoData)
  res.status(200).json(backup)
}

export async function handleLocalImport(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
): Promise<void> {
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
}

export async function handlePreview(req: VercelRequest, res: VercelResponse, { sql, user }: AuthedContext): Promise<void> {
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
  res.status(200).json({ counts, warnings: validation.warnings })
}

export async function handleRestore(req: VercelRequest, res: VercelResponse, { sql, user }: AuthedContext): Promise<void> {
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
}
