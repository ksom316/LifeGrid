import { getDb } from './db'
import { createId, createRepository, nowISO } from './repository'
import {
  computeElapsedMs,
  msToMinutesRounded,
  sessionStatus,
} from '../utils/focusTimer'
import type { FocusSession, FocusSessionType } from '../types/domain'

const repo = createRepository<FocusSession>('focusSessions')

export interface CreateFocusSessionInput {
  durationMinutes: number
  startedAt?: string
  endedAt?: string
  taskId?: string
  projectId?: string
  note?: string
  isDemo?: boolean
}

export interface StartFocusSessionInput {
  type: FocusSessionType
  plannedDurationMinutes: number
  projectId?: string
  taskId?: string
  isDemo?: boolean
}

export const focusSessionsRepo = {
  list: repo.list,
  get: repo.get,
  remove: repo.remove,
  removeMany: repo.removeMany,

  /** Manual/legacy entry point: logs an already-finished session directly. */
  async create(input: CreateFocusSessionInput): Promise<FocusSession> {
    const timestamp = nowISO()
    const startedAt = input.startedAt ?? timestamp
    const session: FocusSession = {
      id: createId(),
      startedAt,
      endedAt: input.endedAt,
      durationMinutes: input.durationMinutes,
      taskId: input.taskId,
      projectId: input.projectId,
      note: input.note?.trim() ?? '',
      type: 'focus',
      status: 'completed',
      plannedDurationMinutes: input.durationMinutes,
      createdAt: timestamp,
      updatedAt: timestamp,
      isDemo: input.isDemo,
    }
    return repo.put(session)
  },

  async update(
    id: string,
    patch: Partial<Omit<FocusSession, 'id' | 'createdAt'>>,
  ): Promise<FocusSession> {
    const existing = await repo.get(id)
    if (!existing) throw new Error(`Focus session ${id} not found`)
    const updated: FocusSession = { ...existing, ...patch, updatedAt: nowISO() }
    return repo.put(updated)
  },

  /** Starts a new timed session. Callers must ensure no other session is active/paused first. */
  async start(input: StartFocusSessionInput): Promise<FocusSession> {
    const timestamp = nowISO()
    const session: FocusSession = {
      id: createId(),
      startedAt: timestamp,
      durationMinutes: 0,
      plannedDurationMinutes: input.plannedDurationMinutes,
      taskId: input.taskId,
      projectId: input.projectId,
      note: '',
      type: input.type,
      status: 'active',
      accumulatedMs: 0,
      resumedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      isDemo: input.isDemo,
    }
    return repo.put(session)
  },

  async pause(id: string): Promise<FocusSession> {
    const existing = await repo.get(id)
    if (!existing) throw new Error(`Focus session ${id} not found`)
    if (sessionStatus(existing) !== 'active') return existing
    const elapsedMs = computeElapsedMs(existing)
    return this.update(id, { status: 'paused', accumulatedMs: elapsedMs, resumedAt: undefined })
  },

  async resume(id: string): Promise<FocusSession> {
    const existing = await repo.get(id)
    if (!existing) throw new Error(`Focus session ${id} not found`)
    if (sessionStatus(existing) !== 'paused') return existing
    return this.update(id, { status: 'active', resumedAt: nowISO() })
  },

  /**
   * Natural completion when the planned duration has been reached. Idempotent.
   *
   * Reads, checks, and writes within a single IndexedDB transaction rather
   * than the generic `update()` helper (which does its own separate read).
   * Two separate read-then-write round trips would let a concurrent
   * `endEarly()` call interleave between this method's own terminal-state
   * check and its write, letting one call's result silently overwrite the
   * other's (e.g. a session ending up 'interrupted' in storage even though
   * this call's return value says 'completed'). A single transaction is
   * serialized against any other transaction on the same store, so the
   * second caller's read is guaranteed to see the first caller's committed
   * write and will correctly no-op instead of racing it.
   */
  async complete(id: string): Promise<FocusSession> {
    return finalizeSession(id, 'completed')
  },

  /** User-initiated early end, before the planned duration is reached. Idempotent (see `complete`). */
  async endEarly(id: string): Promise<FocusSession> {
    return finalizeSession(id, 'interrupted')
  },
}

async function finalizeSession(
  id: string,
  finalStatus: 'completed' | 'interrupted',
): Promise<FocusSession> {
  const db = await getDb()
  const tx = db.transaction('focusSessions', 'readwrite')
  const store = tx.store
  try {
    const existing = await store.get(id)
    if (!existing) throw new Error(`Focus session ${id} not found`)
    const status = sessionStatus(existing)
    if (status === 'completed' || status === 'interrupted') {
      await tx.done
      return existing
    }
    const elapsedMs = computeElapsedMs(existing)
    const updated: FocusSession = {
      ...existing,
      status: finalStatus,
      durationMinutes: msToMinutesRounded(elapsedMs),
      endedAt: nowISO(),
      accumulatedMs: elapsedMs,
      resumedAt: undefined,
      updatedAt: nowISO(),
    }
    await store.put(updated)
    await tx.done
    return updated
  } catch (err) {
    try {
      tx.abort()
    } catch {
      // Transaction may already be closed; nothing more to do.
    }
    await tx.done.catch(() => {})
    throw err
  }
}
