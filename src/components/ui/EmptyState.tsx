import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-xs font-medium text-ink">{title}</p>
      {description && <p className="max-w-xs text-[11px] text-ink-soft">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
