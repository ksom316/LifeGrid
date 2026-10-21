import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

// `brand-ink` is the pale tint used for *text on brand-soft*, not a hover
// fill — using it as a hover background (a prior pass did) washes the
// button out and fails contrast against white label text. Hover instead
// brightens/dims the same hue so the color identity stays put.
const variantClasses: Record<Variant, string> = {
  primary:
    'bg-brand-strong text-white shadow-md shadow-brand-strong/20 hover:bg-brand active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
  secondary:
    'bg-canvas text-ink-soft border border-border hover:border-border-strong hover:bg-surface-hover hover:text-ink active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
  ghost:
    'bg-transparent text-ink-soft hover:bg-surface-hover hover:text-ink active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
  danger:
    'bg-transparent text-danger border border-transparent hover:border-danger/30 hover:bg-danger-soft active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-xs gap-2',
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
