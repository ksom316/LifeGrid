import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { inputClasses } from '../ui/Field'
import { IconX } from '../ui/icons'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  id?: string
}

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase()
}

export function TagInput({ tags, onChange, id }: TagInputProps) {
  const [draft, setDraft] = useState('')

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
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-ink"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag "${tag}"`}
                className="rounded-full hover:text-danger"
              >
                <IconX width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
