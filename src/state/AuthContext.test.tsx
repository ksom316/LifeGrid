import { act, render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

function TestConsumer() {
  const { status, user, error, signUp, logIn, logOut } = useAuth()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user?.email ?? 'none'}</p>
      <p data-testid="error">{error ?? 'none'}</p>
      <button onClick={() => signUp('new@example.com', 'password123').catch(() => {})}>Sign up</button>
      <button onClick={() => logIn('me@example.com', 'password123').catch(() => {})}>Log in</button>
      <button onClick={() => logOut()}>Log out</button>
    </div>
  )
}

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  let call = 0
  globalThis.fetch = vi.fn(async () => {
    const r = responses[Math.min(call, responses.length - 1)]
    call++
    return new Response(JSON.stringify(r.body), { status: r.status })
  }) as typeof fetch
}

describe('AuthContext', () => {
  it('starts "checking" then settles to "signed-out" when there is no session', async () => {
    mockFetchSequence([{ status: 401, body: { error: 'Not signed in.' } }])
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-out'))
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('settles to "signed-in" when a valid session already exists', async () => {
    mockFetchSequence([{ status: 200, body: { user: { id: '1', email: 'existing@example.com' } } }])
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-in'))
    expect(screen.getByTestId('user')).toHaveTextContent('existing@example.com')
  })

  it('signUp transitions to signed-in with the returned user', async () => {
    mockFetchSequence([
      { status: 401, body: { error: 'Not signed in.' } }, // initial session check
      { status: 201, body: { user: { id: '2', email: 'new@example.com' } } }, // signup
    ])
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-out'))

    await act(async () => {
      fireEvent.click(screen.getByText('Sign up'))
    })
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-in'))
    expect(screen.getByTestId('user')).toHaveTextContent('new@example.com')
  })

  it('a failed login surfaces an error message without changing status to signed-in', async () => {
    mockFetchSequence([
      { status: 401, body: { error: 'Not signed in.' } },
      { status: 401, body: { error: 'Invalid email or password.' } },
    ])
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-out'))

    await act(async () => {
      fireEvent.click(screen.getByText('Log in'))
    })
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password.'))
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out')
  })

  it('logOut clears user and status even if the request fails (e.g. offline)', async () => {
    let call = 0
    globalThis.fetch = vi.fn(async () => {
      call++
      if (call === 1) return new Response(JSON.stringify({ user: { id: '3', email: 'me@example.com' } }), { status: 200 })
      throw new Error('network down')
    }) as typeof fetch

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-in'))

    await act(async () => {
      fireEvent.click(screen.getByText('Log out'))
    })
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-out'))
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })
})
