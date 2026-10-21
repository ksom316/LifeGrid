import type { DailyPlan, FocusSession, Note, Project, Task, WeeklyReview } from './domain'

/** Bumped only if the backup envelope shape itself changes (not the app's IndexedDB schema). */
export const BACKUP_FORMAT = 'life-grid-backup'
export const BACKUP_VERSION = 1

export const BACKUP_STORE_KEYS = [
  'projects',
  'tasks',
  'notes',
  'focusSessions',
  'dailyPlans',
  'weeklyReviews',
] as const
export type BackupStoreKey = (typeof BACKUP_STORE_KEYS)[number]

export interface BackupData {
  projects: Project[]
  tasks: Task[]
  notes: Note[]
  focusSessions: FocusSession[]
  dailyPlans: DailyPlan[]
  weeklyReviews: WeeklyReview[]
}

export type BackupCounts = Record<BackupStoreKey, number>

export interface LifeGridBackup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  /** The IndexedDB schema version (src/data/db.ts DB_VERSION) at export time. */
  dbVersion: number
  includesDemoData: boolean
  counts: BackupCounts
  data: BackupData
}

export type RestoreStrategy = 'merge' | 'replace'

export type RecordAction = 'add' | 'update' | 'skip'

export type RestoreCounts = Record<BackupStoreKey, { added: number; updated: number; skipped: number }>

export interface RestoreResult {
  strategy: RestoreStrategy
  counts: RestoreCounts
}

export interface BackupValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  backup?: LifeGridBackup
}
