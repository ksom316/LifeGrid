/**
 * Pure backup validation and merge-decision logic, with zero dependency on
 * IndexedDB/`idb`. Split out of src/data/backup.ts (which re-exports
 * everything here for backward compatibility) so the hosted API
 * (server/repositories/backup.ts) can share the exact same validation and
 * conflict rules the local app uses, instead of maintaining a second,
 * drift-prone copy — "same backup format, same rules, both places."
 */
import { DB_VERSION } from '../types/dbVersion.js'
import { BACKUP_FORMAT, BACKUP_STORE_KEYS, BACKUP_VERSION } from '../types/backup.js'
import type {
  BackupCounts,
  BackupData,
  BackupStoreKey,
  BackupValidationResult,
  LifeGridBackup,
  RecordAction,
  RestoreCounts,
  RestoreStrategy,
} from '../types/backup.js'
import type { BaseRecord } from '../types/domain.js'

export function emptyData(): BackupData {
  return { projects: [], tasks: [], notes: [], focusSessions: [], dailyPlans: [], weeklyReviews: [] }
}

export function countsOf(data: BackupData): BackupCounts {
  return {
    projects: data.projects.length,
    tasks: data.tasks.length,
    notes: data.notes.length,
    focusSessions: data.focusSessions.length,
    dailyPlans: data.dailyPlans.length,
    weeklyReviews: data.weeklyReviews.length,
  }
}

const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly']

function validateRecurrenceShape(raw: unknown, prefix: string): string[] {
  if (typeof raw !== 'object' || raw === null) {
    return [`${prefix} is not a valid recurrence object.`]
  }
  const r = raw as Record<string, unknown>
  const errors: string[] = []
  if (typeof r.frequency !== 'string' || !RECURRENCE_FREQUENCIES.includes(r.frequency)) {
    errors.push(`${prefix} has an invalid "frequency".`)
  }
  if (
    r.weekdays !== undefined &&
    (!Array.isArray(r.weekdays) || r.weekdays.some((d) => typeof d !== 'number' || d < 0 || d > 6))
  ) {
    errors.push(`${prefix} has an invalid "weekdays" list.`)
  }
  if (
    r.dayOfMonth !== undefined &&
    (typeof r.dayOfMonth !== 'number' || r.dayOfMonth < 1 || r.dayOfMonth > 31)
  ) {
    errors.push(`${prefix} has an invalid "dayOfMonth".`)
  }
  if (r.endDate !== undefined && typeof r.endDate !== 'string') {
    errors.push(`${prefix} has an invalid "endDate".`)
  }
  return errors
}

function validateRecordShape(store: BackupStoreKey, raw: unknown, index: number): string[] {
  const prefix = `${store}[${index}]`
  if (typeof raw !== 'object' || raw === null) {
    return [`${prefix} is not an object.`]
  }
  const r = raw as Record<string, unknown>
  const errors: string[] = []

  if (typeof r.id !== 'string' || r.id.length === 0) errors.push(`${prefix} is missing a valid "id".`)
  if (typeof r.createdAt !== 'string') errors.push(`${prefix} is missing "createdAt".`)
  if (typeof r.updatedAt !== 'string') errors.push(`${prefix} is missing "updatedAt".`)
  if (r.isDemo !== undefined && typeof r.isDemo !== 'boolean') {
    errors.push(`${prefix} has an invalid "isDemo" flag.`)
  }

  switch (store) {
    case 'projects':
      if (typeof r.name !== 'string') errors.push(`${prefix} is missing "name".`)
      if (typeof r.description !== 'string') errors.push(`${prefix} is missing "description".`)
      if (typeof r.status !== 'string') errors.push(`${prefix} is missing "status".`)
      if (typeof r.color !== 'string') errors.push(`${prefix} is missing "color".`)
      break
    case 'tasks':
      if (typeof r.title !== 'string') errors.push(`${prefix} is missing "title".`)
      if (typeof r.notes !== 'string') errors.push(`${prefix} is missing "notes".`)
      if (typeof r.status !== 'string') errors.push(`${prefix} is missing "status".`)
      if (typeof r.priority !== 'string') errors.push(`${prefix} is missing "priority".`)
      if (r.recurrence !== undefined) {
        errors.push(...validateRecurrenceShape(r.recurrence, `${prefix}.recurrence`))
      }
      if (r.reminderAt !== undefined && typeof r.reminderAt !== 'string') {
        errors.push(`${prefix} has an invalid "reminderAt".`)
      }
      if (r.recurrenceParentId !== undefined && typeof r.recurrenceParentId !== 'string') {
        errors.push(`${prefix} has an invalid "recurrenceParentId".`)
      }
      break
    case 'notes':
      if (typeof r.title !== 'string') errors.push(`${prefix} is missing "title".`)
      if (typeof r.content !== 'string') errors.push(`${prefix} is missing "content".`)
      if (!Array.isArray(r.tags)) errors.push(`${prefix} has an invalid "tags" list.`)
      break
    case 'focusSessions':
      if (typeof r.startedAt !== 'string') errors.push(`${prefix} is missing "startedAt".`)
      if (typeof r.durationMinutes !== 'number') errors.push(`${prefix} is missing "durationMinutes".`)
      if (typeof r.note !== 'string') errors.push(`${prefix} is missing "note".`)
      break
    case 'dailyPlans':
      if (!Array.isArray(r.taskIds)) errors.push(`${prefix} has an invalid "taskIds" list.`)
      break
    case 'weeklyReviews':
      if (typeof r.weekStart !== 'string') errors.push(`${prefix} is missing "weekStart".`)
      if (typeof r.wins !== 'string') errors.push(`${prefix} is missing "wins".`)
      if (typeof r.blockers !== 'string') errors.push(`${prefix} is missing "blockers".`)
      if (typeof r.lessons !== 'string') errors.push(`${prefix} is missing "lessons".`)
      if (typeof r.nextSteps !== 'string') errors.push(`${prefix} is missing "nextSteps".`)
      break
  }
  return errors
}

/**
 * Defensively parses and validates a candidate backup object. Returns the
 * full, untouched records on success — nothing is stripped or normalized —
 * so unknown/extra fields on each record survive into storage unchanged.
 */
export function validateBackup(input: unknown): BackupValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, errors: ['The file is not a valid backup object.'], warnings }
  }
  const obj = input as Record<string, unknown>

  if (obj.format !== BACKUP_FORMAT) {
    errors.push('This file is not a Life Grid backup (unrecognized format).')
  }
  if (typeof obj.version !== 'number') {
    errors.push('The backup is missing a version number.')
  } else if (obj.version !== BACKUP_VERSION) {
    errors.push(
      `Unsupported backup version ${obj.version}. This version of Life Grid can only restore version ${BACKUP_VERSION} backups.`,
    )
  }
  if (typeof obj.exportedAt !== 'string') {
    errors.push('The backup is missing its export timestamp.')
  }
  if (typeof obj.dbVersion !== 'number') {
    errors.push('The backup is missing its database schema version.')
  } else if (obj.dbVersion > DB_VERSION) {
    errors.push(
      `This backup was created with a newer version of Life Grid (schema v${obj.dbVersion}) than is currently installed (schema v${DB_VERSION}). Update Life Grid before restoring it.`,
    )
  }
  if (typeof obj.data !== 'object' || obj.data === null || Array.isArray(obj.data)) {
    errors.push('The backup is missing its data section.')
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  const rawData = obj.data as Record<string, unknown>
  const data = emptyData()

  for (const key of BACKUP_STORE_KEYS) {
    const list = rawData[key]
    if (!Array.isArray(list)) {
      errors.push(`"${key}" must be a list of records.`)
      continue
    }
    const seenIds = new Set<string>()
    const records: BaseRecord[] = []
    for (const [index, raw] of list.entries()) {
      const recordErrors = validateRecordShape(key, raw, index)
      if (recordErrors.length > 0) {
        errors.push(...recordErrors)
        continue
      }
      const record = raw as BaseRecord
      if (seenIds.has(record.id)) {
        errors.push(`Duplicate id "${record.id}" within "${key}".`)
        continue
      }
      seenIds.add(record.id)
      records.push(record)
    }
    ;(data[key] as BaseRecord[]) = records
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  // Non-fatal: the app already displays dangling references gracefully
  // (e.g. "Deleted project"), so these are surfaced as warnings, not reasons
  // to reject an otherwise well-formed backup.
  const projectIds = new Set(data.projects.map((p) => p.id))
  const taskIds = new Set(data.tasks.map((t) => t.id))

  const orphanTaskProjects = data.tasks.filter((t) => t.projectId && !projectIds.has(t.projectId)).length
  if (orphanTaskProjects > 0) {
    warnings.push(`${orphanTaskProjects} task(s) reference a project not included in this backup.`)
  }
  const orphanNoteProjects = data.notes.filter((n) => n.projectId && !projectIds.has(n.projectId)).length
  if (orphanNoteProjects > 0) {
    warnings.push(`${orphanNoteProjects} note(s) reference a project not included in this backup.`)
  }
  const orphanSessionProjects = data.focusSessions.filter(
    (s) => s.projectId && !projectIds.has(s.projectId),
  ).length
  if (orphanSessionProjects > 0) {
    warnings.push(`${orphanSessionProjects} focus session(s) reference a project not included in this backup.`)
  }
  const orphanSessionTasks = data.focusSessions.filter((s) => s.taskId && !taskIds.has(s.taskId)).length
  if (orphanSessionTasks > 0) {
    warnings.push(`${orphanSessionTasks} focus session(s) reference a task not included in this backup.`)
  }

  const backup: LifeGridBackup = {
    format: BACKUP_FORMAT,
    version: obj.version as number,
    exportedAt: obj.exportedAt as string,
    dbVersion: obj.dbVersion as number,
    includesDemoData: Boolean(obj.includesDemoData),
    counts: countsOf(data),
    data,
  }

  return { valid: true, errors: [], warnings, backup }
}

/**
 * Deterministic merge-conflict rule, documented for users in the restore UI:
 *  - No existing record with this id → add it.
 *  - An incoming demo-flagged record never overwrites an existing non-demo
 *    record, regardless of timestamps (demo data can never clobber real data).
 *  - Otherwise, the record with the later `updatedAt` wins; ties keep the
 *    existing record untouched.
 */
export function decideMergeAction(incoming: BaseRecord, existing: BaseRecord | undefined): RecordAction {
  if (!existing) return 'add'
  if (incoming.isDemo && !existing.isDemo) return 'skip'
  if (incoming.updatedAt > existing.updatedAt) return 'update'
  return 'skip'
}

/** Pure dry-run of what a restore would do, for the confirmation preview. */
export function previewRestore(
  backup: LifeGridBackup,
  strategy: RestoreStrategy,
  current: BackupData,
): RestoreCounts {
  const counts = {} as RestoreCounts
  for (const key of BACKUP_STORE_KEYS) {
    const incoming = backup.data[key] as BaseRecord[]
    if (strategy === 'replace') {
      counts[key] = { added: incoming.length, updated: 0, skipped: 0 }
      continue
    }
    const existingById = new Map((current[key] as BaseRecord[]).map((r) => [r.id, r]))
    let added = 0
    let updated = 0
    let skipped = 0
    for (const record of incoming) {
      const action = decideMergeAction(record, existingById.get(record.id))
      if (action === 'add') added++
      else if (action === 'update') updated++
      else skipped++
    }
    counts[key] = { added, updated, skipped }
  }
  return counts
}
