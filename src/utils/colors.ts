import type { CSSProperties } from 'react'

/**
 * The one shared colour palette for both projects and tags. Deliberately
 * restrained (8 hues) rather than a full colour wheel — "distinct enough to
 * tell things apart at a glance," not a rainbow. `violet`/`teal`/`amber`/
 * `rose`/`slate` are the original five ProjectColor values (see
 * src/types/domain.ts) and must keep their exact spelling: every existing
 * project already has one of these five stored as plain text in its
 * `color` column, and this array has to stay a superset of that for old
 * records to keep resolving correctly.
 */
export const PALETTE_COLORS = ['violet', 'blue', 'teal', 'emerald', 'amber', 'rose', 'pink', 'slate'] as const
export type PaletteColor = (typeof PALETTE_COLORS)[number]

const HEX: Record<PaletteColor, string> = {
  violet: '#8b7bff',
  blue: '#3b82f6',
  teal: '#14b8a6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  pink: '#ec4899',
  slate: '#64748b',
}

const LABELS: Record<PaletteColor, string> = {
  violet: 'Violet',
  blue: 'Blue',
  teal: 'Teal',
  emerald: 'Emerald',
  amber: 'Amber',
  rose: 'Rose',
  pink: 'Pink',
  slate: 'Slate',
}

export function isPaletteColor(value: unknown): value is PaletteColor {
  return typeof value === 'string' && (PALETTE_COLORS as readonly string[]).includes(value)
}

/**
 * Safe fallback for an unknown, missing, or corrupted colour value (e.g. a
 * hand-edited backup file, or a future palette addition this build doesn't
 * know about yet) — never throws, never renders nothing.
 */
export function resolveColor(value: unknown): PaletteColor {
  return isPaletteColor(value) ? value : 'slate'
}

export function colorHex(color: PaletteColor): string {
  return HEX[color]
}

export function colorLabel(color: PaletteColor): string {
  return LABELS[color]
}

/**
 * Deterministically maps an arbitrary string key (a project id, a
 * normalized tag name) to one of the palette colours. Same key always maps
 * to the same colour — stable across reloads, devices, and sessions,
 * because it's a pure function of the key, never randomness evaluated at
 * render time. This is what gives every existing project/tag a sensible
 * default without any data migration: the "default" is just this function
 * applied to an id/name that already exists.
 */
export function colorForKey(key: string): PaletteColor {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % PALETTE_COLORS.length
  return PALETTE_COLORS[index]
}

/**
 * Resolves an identity colour (project or tag) given a possibly-unset
 * stored value and the stable key to derive a default from: a real palette
 * value is always an explicit choice and wins outright; anything else
 * (missing, '', or an unrecognised value) falls back to colorForKey(key)
 * rather than a flat neutral — so an item that was never customised still
 * gets its own distinct, stable colour instead of looking "unset".
 */
export function resolveIdentityColor(value: unknown, key: string): PaletteColor {
  return isPaletteColor(value) ? value : colorForKey(key)
}

/**
 * A project's effective colour: its own explicit `color` if set, else a
 * default derived from its id. Prefer this over resolveColor(project.color)
 * everywhere a project's colour is displayed — resolveColor's fallback is a
 * flat neutral 'slate' for genuinely invalid data (e.g. a corrupted
 * backup), which is the wrong fallback for "never explicitly chosen" (the
 * common case for every project's `color` is '' until a user picks one).
 */
export function resolveProjectColor(project: { id: string; color: unknown }): PaletteColor {
  return resolveIdentityColor(project.color, project.id)
}

/** Solid-fill style for a small identity dot/swatch — the same hue in both themes, by design (an identity colour shouldn't shift when the theme does). */
export function dotStyle(color: PaletteColor): CSSProperties {
  return { backgroundColor: colorHex(color) }
}

/**
 * Tinted badge/pill style: background, border, and text are all mixed from
 * the palette hue against the *current theme's* surface/border/ink tokens
 * via CSS color-mix() (the same technique already used for `.app-glow` in
 * index.css). Because the base tokens it mixes against already flip
 * between dark and light, the resulting tint and its contrast adapt
 * automatically — no separate dark/light declaration needed per colour.
 */
export function badgeStyle(color: PaletteColor): CSSProperties {
  const hex = colorHex(color)
  return {
    backgroundColor: `color-mix(in srgb, ${hex} 16%, var(--color-surface))`,
    borderColor: `color-mix(in srgb, ${hex} 40%, var(--color-border))`,
    color: `color-mix(in srgb, ${hex} 68%, var(--color-ink))`,
  }
}

/** A slim top-edge accent border style, in the palette hue — only the top border, so the card's other edges keep their normal neutral border. */
export function accentBorderStyle(color: PaletteColor): CSSProperties {
  return { borderTopColor: colorHex(color) }
}
