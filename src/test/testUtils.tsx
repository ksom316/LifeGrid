import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { DashboardPage } from '../pages/DashboardPage'
import { FocusTab } from '../pages/focus/FocusTab'
import { HistoryTab } from '../pages/focus/HistoryTab'
import { ReviewsTab } from '../pages/focus/ReviewsTab'
import { KnowledgeVaultPage } from '../pages/KnowledgeVaultPage'
import { NoteDetailPage } from '../pages/NoteDetailPage'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { AppDataProvider } from '../state/AppDataContext'
import { AuthProvider } from '../state/AuthContext'

/**
 * Every render helper wraps with AuthProvider so AppDataProvider's
 * useAuth() call has a provider to read from, exactly like the real app
 * (see src/App.tsx). In jsdom there is no server to answer
 * /api/auth/session, so the request fails immediately and AuthProvider
 * settles to 'signed-out' — these tests exercise the app exactly as it
 * behaves today, signed out and local-only, unless a test explicitly deals
 * with auth state itself.
 */
function withAuth(children: ReactElement) {
  return <AuthProvider>{children}</AuthProvider>
}

/** Renders a single page at a given path, wrapped with the app's real data provider and router. */
export function renderWithProviders(ui: ReactElement, { route = '/', path = '/' } = {}) {
  return render(
    withAuth(
      <MemoryRouter initialEntries={[route]}>
        <AppDataProvider>
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        </AppDataProvider>
      </MemoryRouter>,
    ),
  )
}

/** Renders the real Projects + Project detail routes together, for tests that navigate between them. */
export function renderProjectsApp(route: string) {
  return render(
    withAuth(
      <MemoryRouter initialEntries={[route]}>
        <AppDataProvider>
          <Routes>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </AppDataProvider>
      </MemoryRouter>,
    ),
  )
}

/** Renders the real Vault + Note detail + Project routes together, for tests that navigate between them. */
export function renderVaultApp(route: string) {
  return render(
    withAuth(
      <MemoryRouter initialEntries={[route]}>
        <AppDataProvider>
          <Routes>
            <Route path="/vault" element={<KnowledgeVaultPage />} />
            <Route path="/vault/:id" element={<NoteDetailPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </AppDataProvider>
      </MemoryRouter>,
    ),
  )
}

/** Renders the real Focus/History/Reviews tabs + Projects routes together, for tests that navigate between them. */
export function renderFocusApp(route: string) {
  return render(
    withAuth(
      <MemoryRouter initialEntries={[route]}>
        <AppDataProvider>
          <Routes>
            <Route path="/focus" element={<FocusTab />} />
            <Route path="/focus/history" element={<HistoryTab />} />
            <Route path="/focus/reviews" element={<ReviewsTab />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </AppDataProvider>
      </MemoryRouter>,
    ),
  )
}

/** Renders the real AppShell (sidebar, top bar, global search) wrapping the main routes, for shell-level tests. */
export function renderShellApp(route: string) {
  return render(
    withAuth(
      <MemoryRouter initialEntries={[route]}>
        <AppDataProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/vault" element={<KnowledgeVaultPage />} />
              <Route path="/vault/:id" element={<NoteDetailPage />} />
            </Routes>
          </AppShell>
        </AppDataProvider>
      </MemoryRouter>,
    ),
  )
}
