import { DB_VERSION, STORE_NAMES, getDb } from './db'
import { BACKUP_FORMAT, BACKUP_STORE_KEYS, BACKUP_VERSION } from '../types/backup'
import type { LifeGridBackup, RestoreCounts, RestoreResult, RestoreStrategy } from '../types/backup'
import type { BaseRecord } from '../types/domain'
import { countsOf, decideMergeAction, emptyData } from './backupValidation'

export { validateBackup, decideMergeAction, previewRestore } from './backupValidation'

/**
 * Reads every store directly from IndexedDB (not through each entity
 * repository) so the export is a faithful, complete snapshot — including
 * in-progress focus session timer state — with nothing normalized away.
 */
export async function createBackup(options: { includeDemoData: boolean }): Promise<LifeGridBackup> {
  const db = await getDb()
  const data = emptyData()

  for (const key of BACKUP_STORE_KEYS) {
    const all = (await db.getAll(key)) as BaseRecord[]
    const records = options.includeDemoData ? all : all.filter((r) => !r.isDemo)
    ;(data[key] as BaseRecord[]) = records
  }

  const counts = countsOf(data)

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    dbVersion: DB_VERSION,
    includesDemoData: options.includeDemoData,
    counts,
    data,
  }
}

/**
 * Commits the restore inside a single IndexedDB read-write transaction
 * spanning every managed store, so the restore is truly atomic: if any
 * write fails, IndexedDB aborts the whole transaction and nothing commits —
 * there is no possibility of a half-applied backup.
 */
export async function restoreBackup(
  backup: LifeGridBackup,
  strategy: RestoreStrategy,
): Promise<RestoreResult> {
  const db = await getDb()
  const tx = db.transaction(STORE_NAMES, 'readwrite')
  const counts = {} as RestoreCounts

  try {
    for (const key of BACKUP_STORE_KEYS) {
      // Each record was already validated against its specific store's shape
      // in validateBackup; this cast just tells TS what runtime checks guarantee.
      const store = tx.objectStore(key) as unknown as {
        clear(): Promise<void>
        getAll(): Promise<BaseRecord[]>
        put(record: BaseRecord): Promise<string>
        delete(id: string): Promise<void>
      }
      const incoming = backup.data[key] as BaseRecord[]

      if (strategy === 'replace') {
        await store.clear()
        for (const record of incoming) {
          await store.put(record)
        }
        counts[key] = { added: incoming.length, updated: 0, skipped: 0 }
        continue
      }

      const existing = await store.getAll()
      const existingById = new Map(existing.map((r) => [r.id, r]))
      let added = 0
      let updated = 0
      let skipped = 0
      for (const record of incoming) {
        const action = decideMergeAction(record, existingById.get(record.id))
        if (action === 'skip') {
          skipped++
          continue
        }
        await store.put(record)
        if (action === 'add') added++
        else updated++
      }
      counts[key] = { added, updated, skipped }
    }
  } catch (err) {
    // Explicitly abort rather than relying on IndexedDB's default behavior:
    // some failures (e.g. a value that can't be structured-cloned) throw
    // synchronously without ever queuing a request, so they would NOT
    // otherwise abort a transaction that already has other successful
    // writes queued. Aborting here guarantees true all-or-nothing atomicity
    // for every failure mode, not just request-level errors.
    try {
      tx.abort()
    } catch {
      // Transaction may already be closed; nothing more to do.
    }
    // tx.done now rejects with an AbortError; consume it so it doesn't
    // surface as a separate unhandled rejection alongside the real error.
    await tx.done.catch(() => {})
    throw err
  }

  await tx.done
  return { strategy, counts }
}

/**
 * Permanently deletes every non-demo record across all managed stores in one
 * atomic transaction. Demo records (if any are loaded) are left untouched —
 * this clears real data only, never sample data.
 */
export async function clearAllRealData(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE_NAMES, 'readwrite')
  try {
    for (const key of STORE_NAMES) {
      const store = tx.objectStore(key)
      const all = (await store.getAll()) as BaseRecord[]
      for (const record of all) {
        if (!record.isDemo) await store.delete(record.id)
      }
    }
  } catch (err) {
    try {
      tx.abort()
    } catch {
      // Transaction may already be closed; nothing more to do.
    }
    await tx.done.catch(() => {})
    throw err
  }
  await tx.done
}
