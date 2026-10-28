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

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function rgbDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

describe('palette colour distinctness', () => {
  // Colours whose nearest neighbour on the hue wheel is a *fixed* original-8
  // colour (violet, rose) were tuned so the pair is still easy to tell
  // apart — via lightness/saturation, since the original 8's hue can't move.
  it('indigo is clearly distinguishable from its closest neighbour, violet', () => {
    expect(rgbDistance(colorHex('indigo'), colorHex('violet'))).toBeGreaterThan(60)
  })

  it('red is clearly distinguishable from its closest neighbour, rose', () => {
    expect(rgbDistance(colorHex('red'), colorHex('rose'))).toBeGreaterThan(40)
  })

  it('sky is clearly distinguishable from its closest neighbour, cyan', () => {
    expect(rgbDistance(colorHex('sky'), colorHex('cyan'))).toBeGreaterThan(60)
  })

  it('brown is clearly distinguishable from orange and stone (same hue family)', () => {
    expect(rgbDistance(colorHex('brown'), colorHex('orange'))).toBeGreaterThan(60)
    expect(rgbDistance(colorHex('brown'), colorHex('stone'))).toBeGreaterThan(30)
  })

  it('no two palette colours render identically', () => {
    for (let i = 0; i < PALETTE_COLORS.length; i++) {
      for (let j = i + 1; j < PALETTE_COLORS.length; j++) {
        expect(colorHex(PALETTE_COLORS[i])).not.toBe(colorHex(PALETTE_COLORS[j]))
      }
    }
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

  it('reads its mix strength from the theme-aware --card-tint-* custom properties, with a reasonable fallback', () => {
    const style = cardTintStyle('rose')
    expect(style.backgroundColor).toContain('var(--card-tint-bg,')
    expect(style.borderColor).toContain('var(--card-tint-border,')
  })

  it('is tinted noticeably stronger than the old flat 4% (clearly distinct, not a faint hint of colour)', () => {
    const style = cardTintStyle('rose')
    const fallbackPercent = Number(String(style.backgroundColor).match(/,\s*(\d+)%\)/)?.[1])
    expect(fallbackPercent).toBeGreaterThanOrEqual(10)
  })

  it('the border mix is always stronger than the background mix, for a legible edge', () => {
    const style = cardTintStyle('rose')
    const bgPercent = Number(String(style.backgroundColor).match(/,\s*(\d+)%\)/)?.[1])
    const borderPercent = Number(String(style.borderColor).match(/,\s*(\d+)%\)/)?.[1])
    expect(borderPercent).toBeGreaterThan(bgPercent)
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
