import { useState } from 'react'
import { useAppData } from '../../state/AppDataContext'
import { useAuth } from '../../state/AuthContext'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field, inputClasses } from '../ui/Field'
import { LocalDataMigrationDialog } from './LocalDataMigrationDialog'

type Mode = 'signIn' | 'signUp'

export function AccountSection() {
  const { status, user, error, signUp, logIn, logOut, clearError } = useAuth()
  const { dataSource } = useAppData()
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [migrationOpen, setMigrationOpen] = useState(false)

  if (status === 'checking') {
    return (
      <Card title="Account">
        <p className="text-sm text-ink-soft">Checking your account status…</p>
      </Card>
    )
  }

  if (status === 'signed-in' && user) {
    return (
      <Card title="Account">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-ink">
                Signed in as <span className="font-medium">{user.email}</span>
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Your data now syncs through your hosted Life Grid account — the same data appears on
                any device you sign into.
              </p>
            </div>
            <Button variant="secondary" onClick={logOut}>
              Sign out
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-ink">Import data from this browser</p>
            <p className="mb-3 text-xs text-ink-soft">
              If this browser has Life Grid data that was created before you signed in, you can bring
              it into your account. You'll see exactly what would change before anything is imported,
              and nothing already in your account is ever silently overwritten.
            </p>
            <Button variant="secondary" onClick={() => setMigrationOpen(true)}>
              Check for local data to import
            </Button>
          </div>
        </div>

        <LocalDataMigrationDialog isOpen={migrationOpen} onClose={() => setMigrationOpen(false)} />
      </Card>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'signUp') await signUp(email, password)
      else await logIn(email, password)
    } catch {
      // error is surfaced via AuthContext's `error` state below.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Account">
      <p className="mb-4 text-sm text-ink-soft">
        {dataSource === 'local'
          ? "You're using Life Grid locally — your data stays only in this browser. Sign in or create an account to sync it across devices."
          : 'Sign in to sync your data across devices.'}
      </p>

      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-canvas p-1">
        <button
          type="button"
          onClick={() => {
            setMode('signIn')
            clearError()
          }}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === 'signIn' ? 'bg-surface-raised text-ink shadow-sm ring-1 ring-border-strong' : 'text-ink-soft hover:text-ink'
          }`}
          aria-pressed={mode === 'signIn'}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signUp')
            clearError()
          }}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === 'signUp' ? 'bg-surface-raised text-ink shadow-sm ring-1 ring-border-strong' : 'text-ink-soft hover:text-ink'
          }`}
          aria-pressed={mode === 'signUp'}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Field label="Email">
          <input
            type="email"
            className={inputClasses}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            className={inputClasses}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            minLength={mode === 'signUp' ? 8 : undefined}
            required
          />
        </Field>
        {error && (
          <p role="alert" className="mb-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'signUp' ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </Card>
  )
}
