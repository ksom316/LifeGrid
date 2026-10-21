import { api } from '../../lib/apiClient'
import type { FocusSession } from '../../types/domain'
import type { CreateFocusSessionInput, StartFocusSessionInput } from '../focusSessions'

export const remoteFocusSessionsRepo = {
  async list(): Promise<FocusSession[]> {
    return (await api.get<{ focusSessions: FocusSession[] }>('/api/focus-sessions')).focusSessions
  },
  /** Manual/legacy entry point: logs an already-finished session directly. */
  async create(input: CreateFocusSessionInput): Promise<FocusSession> {
    return (await api.post<{ focusSession: FocusSession }>('/api/focus-sessions', { mode: 'log', ...input })).focusSession
  },
  async start(input: StartFocusSessionInput): Promise<FocusSession> {
    return (await api.post<{ focusSession: FocusSession }>('/api/focus-sessions', { mode: 'start', ...input })).focusSession
  },
  async pause(id: string): Promise<FocusSession> {
    return (await api.post<{ focusSession: FocusSession }>(`/api/focus-sessions/${id}/pause`)).focusSession
  },
  async resume(id: string): Promise<FocusSession> {
    return (await api.post<{ focusSession: FocusSession }>(`/api/focus-sessions/${id}/resume`)).focusSession
  },
  async complete(id: string): Promise<FocusSession> {
    return (await api.post<{ focusSession: FocusSession }>(`/api/focus-sessions/${id}/complete`, { outcome: 'completed' })).focusSession
  },
  async endEarly(id: string): Promise<FocusSession> {
    return (await api.post<{ focusSession: FocusSession }>(`/api/focus-sessions/${id}/complete`, { outcome: 'interrupted' })).focusSession
  },
}
