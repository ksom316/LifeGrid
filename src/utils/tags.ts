import { colorForKey, resolveIdentityColor, resolveProjectColor, type PaletteColor } from './colors'
import type { Note, Project, TagColor } from '../types/domain'

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

/**
 * A Knowledge Vault note card's effective colour, in priority order:
 * 1. Its linked project's colour, if any.
 * 2. Its first tag's colour (note.tags' own stable insertion order — the
 *    same order the tag pills render in), if it has tags but no project.
 * 3. A deterministic colour derived from the note's own id, if it has
 *    neither — so every note gets a stable, distinct accent rather than a
 *    flat neutral, without ever inheriting an arbitrary project's colour.
 */
export function resolveNoteColor(note: Note, project: Project | undefined, tagColors: TagColor[]): PaletteColor {
  if (project) return resolveProjectColor(project)
  if (note.tags.length > 0) return resolveTagColor(tagColors, note.tags[0])
  return colorForKey(note.id)
}
