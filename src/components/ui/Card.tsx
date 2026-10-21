import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
}

export function Card({ title, action, children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/20 ${className}`}
      {...rest}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && (
            <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
