import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'life-grid-theme'

interface ThemeState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

const ThemeContext = createContext<ThemeState | undefined>(undefined)

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // localStorage can throw (private browsing, disabled storage); fall
    // through to the default rather than breaking the app over a preference.
  }
  return 'system'
}

/**
 * 'system' removes the override entirely so the existing
 * `prefers-color-scheme` CSS (src/index.css) decides, matching the app's
 * original OS-driven behavior. 'light'/'dark' set `data-theme` on <html>,
 * which src/index.css gives higher precedence than the media query — see
 * the `:root[data-theme="..."]` blocks there. A blocking inline script in
 * index.html applies the stored choice before first paint, so there's no
 * flash of the wrong theme while React is still loading.
 */
function applyTheme(theme: ThemePreference) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference just won't survive a reload; the live switch still works.
    }
  }, [])

  const value = useMemo<ThemeState>(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
