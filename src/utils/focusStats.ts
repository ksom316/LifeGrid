import { sessionStatus, sessionType } from './focusTimer'
import { getWeekStart, isSameDay, parseDate } from './date'
import type { FocusSession } from '../types/domain'

/** Only completed focus sessions count toward productivity totals — breaks and interrupted sessions never do. */
function isCountableFocusSession(session: FocusSession): boolean {
  return sessionType(session) === 'focus' && sessionStatus(session) === 'completed'
}

export interface FocusStats {
  todayMinutes: number
  weekMinutes: number
  completedCount: number
  averageMinutes: number
  byProject: { projectId: string; minutes: number }[]
}

export function computeFocusStats(sessions: FocusSession[], now: Date = new Date()): FocusStats {
  const completedFocusSessions = sessions.filter(isCountableFocusSession)
  const weekStart = getWeekStart(now)

  const todaySessions = completedFocusSessions.filter((s) => isSameDay(parseDate(s.startedAt), now))
  const weekSessions = completedFocusSessions.filter((s) => parseDate(s.startedAt) >= weekStart)

  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0)
  const weekMinutes = weekSessions.reduce((sum, s) => sum + s.durationMinutes, 0)
  const completedCount = completedFocusSessions.length
  const totalMinutes = completedFocusSessions.reduce((sum, s) => sum + s.durationMinutes, 0)
  const averageMinutes = completedCount === 0 ? 0 : Math.round(totalMinutes / completedCount)

  const projectTotals = new Map<string, number>()
  for (const session of completedFocusSessions) {
    if (!session.projectId) continue
    projectTotals.set(session.projectId, (projectTotals.get(session.projectId) ?? 0) + session.durationMinutes)
  }
  const byProject = Array.from(projectTotals.entries())
    .map(([projectId, minutes]) => ({ projectId, minutes }))
    .sort((a, b) => b.minutes - a.minutes)

  return { todayMinutes, weekMinutes, completedCount, averageMinutes, byProject }
}
