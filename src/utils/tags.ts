import { resolveIdentityColor, type PaletteColor } from './colors'
import type { TagColor } from '../types/domain'

/** The one normalization rule for tag text across the app — trimmed, lowercased. Used both when a tag is attached to a note (TagInput) and as the lookup key for its colour (TagColor.id), so the two always agree on identity. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase()
}

/** A tag's effective colour: the user's explicit override if one exists, else a stable deterministic default — never random, never missing. */
export function resolveTagColor(tagColors: TagColor[], tag: string): PaletteColor {
  const key = normalizeTag(tag)
  const override = tagColors.find((t) => t.id === key)
  return resolveIdentityColor(override?.color, key)
}
