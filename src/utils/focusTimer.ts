import type { FocusSession, FocusSessionStatus, FocusSessionType } from '../types/domain.js'

export const DEFAULT_DURATIONS: Record<FocusSessionType, number> = {
  focus: 25,
  'short-break': 5,
  'long-break': 15,
}

export const SESSION_TYPE_LABEL: Record<FocusSessionType, string> = {
  focus: 'Focus',
  'short-break': 'Short break',
  'long-break': 'Long break',
}

/** Reads a session's type, defaulting to 'focus' for records created before typing existed. */
export function sessionType(session: FocusSession): FocusSessionType {
  return session.type ?? 'focus'
}

/** Reads a session's status, defaulting to 'completed' for legacy manually-logged records. */
export function sessionStatus(session: FocusSession): FocusSessionStatus {
  return session.status ?? 'completed'
}

export function isActiveOrPaused(session: FocusSession): boolean {
  const status = sessionStatus(session)
  return status === 'active' || status === 'paused'
}

/**
 * Computes elapsed milliseconds from persisted timestamps rather than a
 * decrementing counter, so a page refresh or a throttled background tab
 * never corrupts the result — it's recomputed fresh from `now` every call.
 */
export function computeElapsedMs(session: FocusSession, now: number = Date.now()): number {
  const accumulated = session.accumulatedMs ?? 0
  if (sessionStatus(session) === 'active' && session.resumedAt) {
    const resumedAtMs = new Date(session.resumedAt).getTime()
    return accumulated + Math.max(0, now - resumedAtMs)
  }
  return accumulated
}

export function plannedDurationMs(session: FocusSession): number {
  const minutes = session.plannedDurationMinutes ?? session.durationMinutes
  return minutes * 60_000
}

export function remainingMs(session: FocusSession, now: number = Date.now()): number {
  return Math.max(0, plannedDurationMs(session) - computeElapsedMs(session, now))
}

export function hasReachedPlannedDuration(session: FocusSession, now: number = Date.now()): boolean {
  return computeElapsedMs(session, now) >= plannedDurationMs(session)
}

export function msToMinutesRounded(ms: number): number {
  return Math.round(ms / 60_000)
}

/** Formats milliseconds as "mm:ss", clamped at zero. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}
