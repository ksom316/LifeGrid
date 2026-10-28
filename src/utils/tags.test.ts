import { describe, expect, it } from 'vitest'
import { normalizeTag, resolveTagColor } from './tags'
import { colorForKey } from './colors'
import type { TagColor } from '../types/domain'

describe('normalizeTag', () => {
  it('trims and lowercases', () => {
    expect(normalizeTag('  Work  ')).toBe('work')
  })
})

describe('resolveTagColor', () => {
  it('falls back to the deterministic default when there is no override', () => {
    expect(resolveTagColor([], 'work')).toBe(colorForKey('work'))
  })

  it('is stable across reloads for the same tag (same input, same output)', () => {
    const a = resolveTagColor([], 'personal')
    const b = resolveTagColor([], 'personal')
    expect(a).toBe(b)
  })

  it('uses a stored override when one exists', () => {
    const override: TagColor = { id: 'work', color: 'rose', createdAt: '', updatedAt: '' }
    expect(resolveTagColor([override], 'work')).toBe('rose')
  })

  it('matches overrides by normalized tag text', () => {
    const override: TagColor = { id: 'work', color: 'rose', createdAt: '', updatedAt: '' }
    expect(resolveTagColor([override], '  WORK  ')).toBe('rose')
  })
})
