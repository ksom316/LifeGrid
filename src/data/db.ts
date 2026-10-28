import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { DailyPlan, FocusSession, Note, Project, Task, TagColor, WeeklyReview } from '../types/domain'
import { DB_VERSION } from '../types/dbVersion'

const DB_NAME = 'life-grid'
export { DB_VERSION }

export const STORE_NAMES = [
  'projects',
  'tasks',
  'notes',
  'focusSessions',
  'dailyPlans',
  'weeklyReviews',
  'tagColors',
] as const
export type StoreName = (typeof STORE_NAMES)[number]

interface LifeGridSchema extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: { 'by-updatedAt': string }
  }
  tasks: {
    key: string
    value: Task
    indexes: { 'by-updatedAt': string; 'by-projectId': string }
  }
  notes: {
    key: string
    value: Note
    indexes: { 'by-updatedAt': string; 'by-projectId': string }
  }
  focusSessions: {
    key: string
    value: FocusSession
    indexes: { 'by-startedAt': string }
  }
  /** Keyed by its own id, which is the local date string "YYYY-MM-DD". */
  dailyPlans: {
    key: string
    value: DailyPlan
  }
  /** Keyed by its own id, which is the local Monday date string "YYYY-MM-DD". */
  weeklyReviews: {
    key: string
    value: WeeklyReview
  }
  /** Keyed by its own id, which is the normalized tag name. */
  tagColors: {
    key: string
    value: TagColor
  }
}

let dbPromise: Promise<IDBPDatabase<LifeGridSchema>> | null = null

/**
 * Opens (or creates) the Life Grid IndexedDB database. Upgrades only ever add
 * stores/indexes — existing records are never dropped or reset.
 */
export function getDb(): Promise<IDBPDatabase<LifeGridSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<LifeGridSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' })
          store.createIndex('by-updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('tasks')) {
          const store = db.createObjectStore('tasks', { keyPath: 'id' })
          store.createIndex('by-updatedAt', 'updatedAt')
          store.createIndex('by-projectId', 'projectId')
        }
        if (!db.objectStoreNames.contains('notes')) {
          const store = db.createObjectStore('notes', { keyPath: 'id' })
          store.createIndex('by-updatedAt', 'updatedAt')
          store.createIndex('by-projectId', 'projectId')
        }
        if (!db.objectStoreNames.contains('focusSessions')) {
          const store = db.createObjectStore('focusSessions', { keyPath: 'id' })
          store.createIndex('by-startedAt', 'startedAt')
        }
        if (!db.objectStoreNames.contains('dailyPlans')) {
          db.createObjectStore('dailyPlans', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('weeklyReviews')) {
          db.createObjectStore('weeklyReviews', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('tagColors')) {
          db.createObjectStore('tagColors', { keyPath: 'id' })
        }
      },
    }).catch((err) => {
      dbPromise = null
      throw err
    })
  }
  return dbPromise
}

export type { LifeGridSchema }
