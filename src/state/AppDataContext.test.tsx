import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppDataProvider, useAppData } from './AppDataContext'
import { AuthProvider } from './AuthContext'
import { projectsRepo } from '../data/projects'

function TestConsumer() {
  const { status, dataSource, projects } = useAppData()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="source">{dataSource}</p>
      <p data-testid="count">{projects.length}</p>
    </div>
  )
}

describe('AppDataContext — data source switching', () => {
  it('uses local IndexedDB when signed out (unchanged default behavior)', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 })) as typeof fetch
    await projectsRepo.create({ name: 'Local-only project' })

    render(
      <AuthProvider>
        <AppDataProvider>
          <TestConsumer />
        </AppDataProvider>
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
    expect(screen.getByTestId('source')).toHaveTextContent('local')
    expect(screen.getByTestId('count')).toHaveTextContent('1')

    const projectRequests = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/projects'),
    )
    expect(projectRequests).toHaveLength(0) // never touched the hosted API
  })

  it('switches to the hosted API once signed in, and reads its data instead of IndexedDB', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/session')) {
        return new Response(JSON.stringify({ user: { id: 'u1', email: 'me@example.com' } }), { status: 200 })
      }
      if (url.includes('/api/projects')) {
        return new Response(
          JSON.stringify({ projects: [{ id: 'p1', name: 'Hosted project', description: '', status: 'active', color: 'violet', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] }),
          { status: 200 },
        )
      }
      // tasks/notes/focusSessions/dailyPlans/weeklyReviews
      const key = url.includes('/api/tasks') ? 'tasks'
        : url.includes('/api/notes') ? 'notes'
        : url.includes('/api/focus-sessions') ? 'focusSessions'
        : url.includes('/api/daily-plans') ? 'dailyPlans'
        : 'weeklyReviews'
      return new Response(JSON.stringify({ [key]: [] }), { status: 200 })
    }) as typeof fetch

    render(
      <AuthProvider>
        <AppDataProvider>
          <TestConsumer />
        </AppDataProvider>
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('source')).toHaveTextContent('hosted'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
    expect(screen.getByTestId('count')).toHaveTextContent('1')

    const projectRequests = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/projects'),
    )
    expect(projectRequests.length).toBeGreaterThan(0)
  })
})
