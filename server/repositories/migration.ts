import { createHash, randomUUID } from 'node:crypto'
import type { Sql, SqlPool } from '../db.js'
import type { BackupData, LifeGridBackup, RestoreResult, RestoreStrategy } from '../../src/types/backup.js'
import { restoreBackupForUser } from './backup.js'

/**
 * A content fingerprint of a local backup's record identity — which ids
 * exist in which store, each paired with its updatedAt — not of the full
 * payload bytes. Two uploads of "the same local data" fingerprint
 * identically even if JSON key order or incidental formatting differs,
 * which byte-hashing the raw request body would not guarantee.
 *
 * Note this is a UX safeguard ("you've already imported this exact
 * snapshot"), not the mechanism that actually prevents duplicate records —
 * that guarantee comes from decideMergeAction() being idempotent by
 * construction (re-importing an unchanged record always "skips" it because
 * its id already exists and its updatedAt hasn't advanced). This fingerprint
 * only lets the onboarding UI short-circuit and say so without re-running
 * the whole merge.
 */
export function fingerprintBackup(data: BackupData): string {
  const hash = createHash('sha256')
  const keys = ['projects', 'tasks', 'notes', 'focusSessions', 'dailyPlans', 'weeklyReviews'] as const
  for (const key of keys) {
    const ids = (data[key] as { id: string; updatedAt: string }[])
      .map((r) => `${r.id}:${r.updatedAt}`)
      .sort()
    hash.update(key)
    hash.update('|')
    hash.update(ids.join(','))
    hash.update(';')
  }
  return hash.digest('hex')
}

export interface ImportLocalBackupResult extends RestoreResult {
  alreadyImported: boolean
}

export async function hasAlreadyImported(sql: Sql, userId: string, fingerprint: string): Promise<boolean> {
  const { rows } = await sql.query('select 1 from local_imports where user_id = $1 and fingerprint = $2', [
    userId,
    fingerprint,
  ])
  return rows.length > 0
}

/**
 * The entry point for the "safe migration of existing local data" flow: a
 * previously-exported local backup is restored into the authenticated
 * user's hosted account, then the import is recorded so a second upload of
 * the identical snapshot is recognized and skipped (`alreadyImported: true`,
 * no writes) instead of silently re-running — the client-side onboarding UI
 * uses this to show "already imported" rather than letting the user
 * re-trigger it by accident (e.g. a double click, or reopening the same
 * browser tab later).
 */
export async function importLocalBackup(
  sql: SqlPool,
  userId: string,
  backup: LifeGridBackup,
  strategy: RestoreStrategy,
): Promise<ImportLocalBackupResult> {
  const fingerprint = fingerprintBackup(backup.data)
  if (await hasAlreadyImported(sql, userId, fingerprint)) {
    return { strategy, counts: zeroCounts(), alreadyImported: true }
  }

  const result = await restoreBackupForUser(sql, userId, backup, strategy)

  await sql.query('insert into local_imports (id, user_id, fingerprint, record_counts) values ($1,$2,$3,$4)', [
    randomUUID(),
    userId,
    fingerprint,
    JSON.stringify(result.counts),
  ])

  return { ...result, alreadyImported: false }
}

function zeroCounts(): RestoreResult['counts'] {
  const zero = { added: 0, updated: 0, skipped: 0 }
  return {
    projects: { ...zero },
    tasks: { ...zero },
    notes: { ...zero },
    focusSessions: { ...zero },
    dailyPlans: { ...zero },
    weeklyReviews: { ...zero },
  }
}
