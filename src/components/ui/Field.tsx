import { cloneElement, useId } from 'react'
import type { ReactElement } from 'react'

type FieldChild = ReactElement<{
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}>

interface FieldProps {
  label: string
  error?: string
  children: FieldChild
}

export function Field({ label, error, children }: FieldProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`

  const control = cloneElement(children, {
    id: inputId,
    'aria-invalid': Boolean(error),
    ...(error ? { 'aria-describedby': errorId } : {}),
  })

  return (
    <label htmlFor={inputId} className="mb-3 block text-sm">
      <span className="mb-1.5 block text-xs text-ink-soft">
        {label}
      </span>
      {control}
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  )
}

const inputClasses =
  'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-ink placeholder:text-muted transition-colors focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20 aria-invalid:border-danger aria-invalid:focus:ring-danger/25'

export { inputClasses }
