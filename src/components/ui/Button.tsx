import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand-ink active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
  secondary:
    'bg-surface text-ink border border-border hover:border-border-strong hover:bg-surface-hover active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
  ghost:
    'bg-transparent text-ink-soft hover:bg-surface-hover hover:text-ink active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
  danger:
    'bg-transparent text-danger hover:bg-danger-soft active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
