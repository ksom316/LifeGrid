import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { inputClasses } from '../ui/Field'
import { IconX } from '../ui/icons'
import { ColorDot, ColorSwatchPicker } from '../ui/ColorSwatch'
import { useAppData } from '../../state/AppDataContext'
import type { PaletteColor } from '../../utils/colors'
import { normalizeTag, resolveTagColor } from '../../utils/tags'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  id?: string
}

export function TagInput({ tags, onChange, id }: TagInputProps) {
  const { tagColors, setTagColor } = useAppData()
  const [draft, setDraft] = useState('')
  const [openPicker, setOpenPicker] = useState<string | null>(null)

  const commitDraft = () => {
    const tag = normalizeTag(draft)
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setDraft('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitDraft()
    } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div>
      <input
        id={id}
        className={inputClasses}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder="Add a tag and press Enter"
      />
      {tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const color = resolveTagColor(tagColors, tag)
            return (
              <li key={tag}>
                <span className="inline-flex items-center gap-1 rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand-ink">
                  <button
                    type="button"
                    onClick={() => setOpenPicker(openPicker === tag ? null : tag)}
                    aria-label={`Change colour for tag "${tag}"`}
                    aria-expanded={openPicker === tag}
                    className="rounded-full"
                  >
                    <ColorDot color={color} />
                  </button>
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove tag "${tag}"`}
                    className="rounded-full hover:text-danger"
                  >
                    <IconX width={10} height={10} />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {openPicker && tags.includes(openPicker) && (
        <div className="mt-2 rounded-lg border border-border bg-canvas p-2">
          <p className="mb-1.5 text-[11px] text-ink-soft">Colour for &quot;{openPicker}&quot;</p>
          <ColorSwatchPicker
            value={resolveTagColor(tagColors, openPicker)}
            aria-label={`Colour for tag "${openPicker}"`}
            onChange={(next: PaletteColor) => {
              setTagColor(openPicker, next)
              setOpenPicker(null)
            }}
          />
        </div>
      )}
    </div>
  )
}
