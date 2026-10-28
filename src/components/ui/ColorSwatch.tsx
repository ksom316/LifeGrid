import { PALETTE_COLORS, badgeStyle, colorLabel, dotStyle, resolveColor } from '../../utils/colors'
import type { PaletteColor } from '../../utils/colors'
import { IconCheck } from './icons'

/**
 * Shared project/tag colour display + selection primitives, built on the
 * palette in src/utils/colors.ts. Kept deliberately small — a dot, a
 * tinted pill, and a swatch picker — rather than a general "colour
 * management" system, per the identity-colour requirements (projects/tags
 * in the Dashboard, Projects, Knowledge Vault, etc.) across the app.
 */

export function ColorDot({ color, className = '' }: { color: unknown; className?: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
      style={dotStyle(resolveColor(color))}
      aria-hidden="true"
    />
  )
}

interface ColorBadgeProps {
  color: unknown
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

/** A tinted pill for an identity colour (project or tag) — distinct from ui/Badge's semantic status/priority tones, which must never be overridden by a project's colour. */
export function ColorBadge({ color, children, icon, className = '' }: ColorBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
      style={badgeStyle(resolveColor(color))}
    >
      {icon}
      {children}
    </span>
  )
}

interface ColorSwatchPickerProps {
  value: unknown
  onChange: (color: PaletteColor) => void
  'aria-label'?: string
}

/** A row of clickable colour swatches, used wherever a project or tag colour is chosen — an accessible alternative to typing a hex code. */
export function ColorSwatchPicker({ value, onChange, 'aria-label': ariaLabel }: ColorSwatchPickerProps) {
  const selected = value == null ? null : resolveColor(value)
  return (
    <div role="radiogroup" aria-label={ariaLabel ?? 'Colour'} className="flex flex-wrap gap-2">
      {PALETTE_COLORS.map((color) => {
        const isSelected = color === selected
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={colorLabel(color)}
            title={colorLabel(color)}
            onClick={() => onChange(color)}
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${
              isSelected ? 'border-ink' : 'border-transparent'
            }`}
            style={dotStyle(color)}
          >
            {isSelected && <IconCheck width={14} height={14} className="text-white" />}
          </button>
        )
      })}
    </div>
  )
}
