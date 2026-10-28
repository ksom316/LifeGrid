import { createRepository, nowISO } from './repository'
import type { PaletteColor } from '../utils/colors'
import type { TagColor } from '../types/domain'

const repo = createRepository<TagColor>('tagColors')

export const tagColorsRepo = {
  list: repo.list,

  /** A tag with no record isn't "uncoloured" — callers fall back to colorForKey(tag) for a stable default. */
  async get(tag: string): Promise<TagColor | undefined> {
    return repo.get(tag)
  },

  async setColor(tag: string, color: PaletteColor): Promise<TagColor> {
    const existing = await repo.get(tag)
    const timestamp = nowISO()
    const record: TagColor = {
      id: tag,
      color,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    return repo.put(record)
  },

  async remove(tag: string): Promise<void> {
    return repo.remove(tag)
  },
}
