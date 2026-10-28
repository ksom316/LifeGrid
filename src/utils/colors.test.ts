import { describe, expect, it } from 'vitest'
import {
  PALETTE_COLORS,
  badgeStyle,
  cardTintStyle,
  colorForKey,
  colorHex,
  colorLabel,
  dotStyle,
  isPaletteColor,
  resolveColor,
  resolveIdentityColor,
  resolveProjectColor,
} from './colors'

describe('isPaletteColor', () => {
  it('accepts every defined palette colour', () => {
    for (const c of PALETTE_COLORS) expect(isPaletteColor(c)).toBe(true)
  })

  it('rejects an unknown string', () => {
    expect(isPaletteColor('mauve')).toBe(false)
  })

  it('rejects non-string values without throwing', () => {
    expect(isPaletteColor(undefined)).toBe(false)
    expect(isPaletteColor(null)).toBe(false)
    expect(isPaletteColor(42)).toBe(false)
    expect(isPaletteColor({})).toBe(false)
  })
})

describe('resolveColor', () => {
  it('passes through a valid colour unchanged', () => {
    expect(resolveColor('rose')).toBe('rose')
  })

  it('falls back to slate for an unknown or missing value', () => {
    expect(resolveColor('not-a-colour')).toBe('slate')
    expect(resolveColor(undefined)).toBe('slate')
    expect(resolveColor(null)).toBe('slate')
  })

  it('keeps the original five ProjectColor values working (backward compatibility)', () => {
    for (const legacy of ['violet', 'teal', 'amber', 'rose', 'slate']) {
      expect(resolveColor(legacy)).toBe(legacy)
    }
  })
})

describe('colorForKey', () => {
  it('is deterministic — the same key always maps to the same colour', () => {
    const a = colorForKey('project-123')
    const b = colorForKey('project-123')
    const c = colorForKey('project-123')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('always returns a valid palette colour', () => {
    const keys = ['', 'a', 'a very long project name with spaces', '🎉', 'ID-WITH-DASHES-123']
    for (const key of keys) {
      expect(PALETTE_COLORS).toContain(colorForKey(key))
    }
  })

  it('distributes different keys across more than one colour (not a constant)', () => {
    const results = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(colorForKey))
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('expanded palette', () => {
  it('has approximately 20 colours', () => {
    expect(PALETTE_COLORS.length).toBeGreaterThanOrEqual(18)
    expect(PALETTE_COLORS.length).toBeLessThanOrEqual(24)
  })

  it('keeps the original 8 colours at their original hex values (preserves existing saved/rendered colours)', () => {
    const original: Record<string, string> = {
      violet: '#8b7bff',
      blue: '#3b82f6',
      teal: '#14b8a6',
      emerald: '#10b981',
      amber: '#f59e0b',
      rose: '#f43f5e',
      pink: '#ec4899',
      slate: '#64748b',
    }
    for (const [name, hex] of Object.entries(original)) {
      expect(isPaletteColor(name)).toBe(true)
      expect(colorHex(name as never)).toBe(hex)
    }
  })

  it('every colour has a distinct hex value (no accidental duplicates)', () => {
    const hexes = PALETTE_COLORS.map((c) => colorHex(c))
    expect(new Set(hexes).size).toBe(PALETTE_COLORS.length)
  })

  it('distributes many distinct keys across a wide spread of the expanded palette', () => {
    const keys = Array.from({ length: 200 }, (_, i) => `key-${i}`)
    const used = new Set(keys.map(colorForKey))
    // Not every one of the 20 colours is guaranteed to appear, but a wide
    // automatic spread (not just a handful of buckets) is expected.
    expect(used.size).toBeGreaterThan(10)
  })
})

describe('cardTintStyle', () => {
  it('derives background and border from the theme tokens via color-mix, same adaptive technique as badgeStyle', () => {
    const style = cardTintStyle('emerald')
    expect(style.backgroundColor).toContain('color-mix')
    expect(style.backgroundColor).toContain('#10b981')
    expect(style.backgroundColor).toContain('var(--color-surface)')
    expect(style.borderColor).toContain('color-mix')
    expect(style.borderColor).toContain('var(--color-border)')
  })

  it('tints the background much more subtly than a badge, to keep body text readable', () => {
    const card = cardTintStyle('rose')
    const badge = badgeStyle('rose')
    const cardPercent = Number(String(card.backgroundColor).match(/(\d+)%/)?.[1])
    const badgePercent = Number(String(badge.backgroundColor).match(/(\d+)%/)?.[1])
    expect(cardPercent).toBeLessThan(badgePercent)
  })
})

describe('colorHex / colorLabel', () => {
  it('returns a hex colour for every palette entry', () => {
    for (const c of PALETTE_COLORS) {
      expect(colorHex(c)).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('returns a human-readable label for every palette entry', () => {
    for (const c of PALETTE_COLORS) {
      expect(colorLabel(c).length).toBeGreaterThan(0)
    }
  })
})

describe('resolveIdentityColor', () => {
  it('passes through a valid explicit colour unchanged', () => {
    expect(resolveIdentityColor('rose', 'any-key')).toBe('rose')
  })

  it('derives a default from the key when the value is unset, empty, or invalid', () => {
    for (const value of [undefined, null, '', 'not-a-colour']) {
      expect(resolveIdentityColor(value, 'proj-123')).toBe(colorForKey('proj-123'))
    }
  })

  it('is deterministic for a given key', () => {
    const a = resolveIdentityColor(undefined, 'stable-key')
    const b = resolveIdentityColor(undefined, 'stable-key')
    expect(a).toBe(b)
  })
})

describe('resolveProjectColor', () => {
  it('uses the explicit colour when the project has one', () => {
    expect(resolveProjectColor({ id: 'p1', color: 'amber' })).toBe('amber')
  })

  it('derives a stable default from the project id when colour is empty/unset', () => {
    expect(resolveProjectColor({ id: 'p1', color: '' })).toBe(colorForKey('p1'))
    expect(resolveProjectColor({ id: 'p1', color: undefined })).toBe(colorForKey('p1'))
  })

  it('falls back safely for a corrupted/unknown stored value', () => {
    expect(resolveProjectColor({ id: 'p1', color: 'not-a-real-colour' })).toBe(colorForKey('p1'))
  })

  it('different project ids distribute across more than one colour', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const colors = new Set(ids.map((id) => resolveProjectColor({ id, color: '' })))
    expect(colors.size).toBeGreaterThan(1)
  })
})

describe('dotStyle / badgeStyle', () => {
  it('dotStyle sets a solid background colour', () => {
    expect(dotStyle('teal')).toEqual({ backgroundColor: '#14b8a6' })
  })

  it('badgeStyle derives background, border, and text from the theme tokens via color-mix', () => {
    const style = badgeStyle('amber')
    expect(style.backgroundColor).toContain('color-mix')
    expect(style.backgroundColor).toContain('#f59e0b')
    expect(style.backgroundColor).toContain('var(--color-surface)')
    expect(style.borderColor).toContain('var(--color-border)')
    expect(style.color).toContain('var(--color-ink)')
  })
})
