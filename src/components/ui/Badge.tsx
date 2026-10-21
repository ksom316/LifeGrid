import type { ReactNode } from 'react'

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral'

const toneClasses: Record<Tone, string> = {
  brand: 'border border-brand/25 bg-brand/10 text-brand-ink',
  success: 'border border-success/25 bg-success/10 text-success',
  warning: 'border border-warning/25 bg-warning/10 text-warning',
  danger: 'border border-danger/25 bg-danger/10 text-danger',
  neutral: 'border border-border bg-canvas text-ink-soft',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}
