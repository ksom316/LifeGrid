import { getDb } from './db'
import type { LifeGridSchema, StoreName } from './db'
import type { BaseRecord } from '../types/domain'

/**
 * Generic CRUD repository over a single IndexedDB object store.
 * Entity modules wrap this with their own type and defaults; the store's
 * value type is asserted to T since each entity module only ever reads the
 * store that matches its own domain type.
 */
export function createRepository<T extends BaseRecord>(storeName: StoreName) {
  return {
    async list(): Promise<T[]> {
      const db = await getDb()
      return (await db.getAll(storeName)) as unknown as T[]
    },

    async get(id: string): Promise<T | undefined> {
      const db = await getDb()
      return (await db.get(storeName, id)) as unknown as T | undefined
    },

    async put(record: T): Promise<T> {
      const db = await getDb()
      await db.put(storeName, record as unknown as LifeGridSchema[typeof storeName]['value'])
      return record
    },

    async remove(id: string): Promise<void> {
      const db = await getDb()
      await db.delete(storeName, id)
    },

    async removeMany(ids: string[]): Promise<void> {
      const db = await getDb()
      const tx = db.transaction(storeName, 'readwrite')
      await Promise.all(ids.map((id) => tx.store.delete(id)))
      await tx.done
    },
  }
}

export function createId(): string {
  return crypto.randomUUID()
}

export function nowISO(): string {
  return new Date().toISOString()
}
