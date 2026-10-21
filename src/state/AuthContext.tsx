import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError, UnauthorizedError } from '../lib/apiClient'

export interface AuthUser {
  id: string
  email: string
}

export type AuthStatus = 'checking' | 'signed-out' | 'signed-in'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  signUp: (email: string, password: string) => Promise<void>
  logIn: (email: string, password: string) => Promise<void>
  logOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

/**
 * Hosted-account session state, entirely separate from AppDataContext's
 * local-first data state. The app works fully signed-out (local-only, as
 * before); signing in is opt-in and only changes where AppDataContext reads
 * and writes data (see src/state/AppDataContext.tsx) — it does not require
 * it.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ user: AuthUser }>('/api/auth/session')
      .then((res) => {
        if (cancelled) return
        setUser(res.user)
        setStatus('signed-in')
      })
      .catch(() => {
        if (cancelled) return
        setUser(null)
        setStatus('signed-out')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null)
    try {
      const res = await api.post<{ user: AuthUser }>('/api/auth/signup', { email, password })
      setUser(res.user)
      setStatus('signed-in')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create an account. Try again.')
      throw err
    }
  }, [])

  const logIn = useCallback(async (email: string, password: string) => {
    setError(null)
    try {
      const res = await api.post<{ user: AuthUser }>('/api/auth/login', { email, password })
      setUser(res.user)
      setStatus('signed-in')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Try again.')
      throw err
    }
  }, [])

  const logOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Even if the request fails (e.g. offline), drop local auth state —
      // the user asked to sign out and the UI must reflect that immediately.
    }
    setUser(null)
    setStatus('signed-out')
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<AuthState>(
    () => ({ status, user, error, signUp, logIn, logOut, clearError }),
    [status, user, error, signUp, logIn, logOut, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export { UnauthorizedError }
