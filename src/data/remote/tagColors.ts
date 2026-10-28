import { api } from '../../lib/apiClient'
import type { PaletteColor } from '../../utils/colors'
import type { TagColor } from '../../types/domain'

export const remoteTagColorsRepo = {
  async list(): Promise<TagColor[]> {
    return (await api.get<{ tagColors: TagColor[] }>('/api/tag-colors')).tagColors
  },
  async get(tag: string): Promise<TagColor | undefined> {
    const all = await this.list()
    return all.find((t) => t.id === tag)
  },
  async setColor(tag: string, color: PaletteColor): Promise<TagColor> {
    return (await api.put<{ tagColor: TagColor }>('/api/tag-colors', { tag, color })).tagColor
  },
  async remove(tag: string): Promise<void> {
    await api.delete('/api/tag-colors', { tag })
  },
}
