import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
}

export function Card({ title, action, children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${className}`}
      {...rest}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-3">
          {title && (
            <h2 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
