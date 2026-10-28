import { describe, expect, it } from 'vitest'
import {
  PALETTE_COLORS,
  badgeStyle,
  colorForKey,
  colorHex,
  colorLabel,
  dotStyle,
  isPaletteColor,
  resolveColor,
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
