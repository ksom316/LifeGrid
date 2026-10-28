import { tokenizeCode } from '../../utils/codeHighlight'
import { parseNoteBlocks } from '../../utils/noteBlocks'
import type { NoteBlock } from '../../utils/noteBlocks'
import type { TokenType } from '../../utils/codeHighlight'

interface NoteContentProps {
  content: string
  /** When true, checklist items are real clickable checkboxes. */
  interactive?: boolean
  onToggleLine?: (lineIndex: number) => void
}

const TOKEN_CLASS: Record<TokenType, string> = {
  comment: 'text-muted italic',
  string: 'text-success',
  number: 'text-warning',
  keyword: 'text-brand-ink',
  plain: '',
}

const LIST_MARKER: Record<'bullet' | 'dash', string> = {
  bullet: '•',
  dash: '–',
}

/**
 * Renders a note's stored plain-text content (Note.content — still just a
 * string, see src/types/domain.ts) as prose, lists, checklists, and code
 * blocks. A note with none of the recognized line-marker syntax (every
 * note saved before this editor existed) produces a single paragraph
 * block and renders exactly as NoteDetailPage always has: one
 * `white-space: pre-wrap` block with the untouched original text, so old
 * notes are pixel-identical to before this feature existed.
 */
export function NoteContent({ content, interactive = false, onToggleLine }: NoteContentProps) {
  const blocks = parseNoteBlocks(content)
  const renderable = blocks.filter((b) => !(blocks.length > 1 && b.type === 'paragraph' && b.text.trim() === ''))

  return (
    <div className="flex flex-col gap-4">
      {renderable.map((block, i) => (
        <NoteBlockView key={i} block={block} interactive={interactive} onToggleLine={onToggleLine} />
      ))}
    </div>
  )
}

function NoteBlockView({
  block,
  interactive,
  onToggleLine,
}: {
  block: NoteBlock
  interactive: boolean
  onToggleLine?: (lineIndex: number) => void
}) {
  if (block.type === 'paragraph') {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{block.text}</p>
  }

  if (block.type === 'code') {
    const tokens = tokenizeCode(block.code)
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-canvas">
        {block.lang && (
          <div className="border-b border-border px-3 py-1 text-[10px] font-medium tracking-wide text-ink-soft uppercase">
            {block.lang}
          </div>
        )}
        <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
          <code className="font-mono whitespace-pre text-ink">
            {tokens.map((t, i) => (
              <span key={i} className={TOKEN_CLASS[t.type]}>
                {t.text}
              </span>
            ))}
          </code>
        </pre>
      </div>
    )
  }

  // Lists
  if (block.kind === 'numbered') {
    return (
      <ol className="flex flex-col gap-1.5 text-sm text-ink">
        {block.items.map((item, i) => (
          <li key={item.lineIndex} className="flex gap-2.5">
            <span className="w-5 shrink-0 text-right text-ink-soft tabular-nums">{i + 1}.</span>
            <span className="whitespace-pre-wrap">{item.content}</span>
          </li>
        ))}
      </ol>
    )
  }

  if (block.kind === 'checklist') {
    return (
      <ul className="flex flex-col gap-1.5 text-sm text-ink">
        {block.items.map((item) => (
          <li key={item.lineIndex} className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={item.checked ?? false}
              disabled={!interactive}
              onChange={() => onToggleLine?.(item.lineIndex)}
              aria-label={item.content || 'Checklist item'}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border-strong accent-brand disabled:cursor-default"
            />
            <span className={`whitespace-pre-wrap ${item.checked ? 'text-ink-soft line-through' : ''}`}>
              {item.content}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  // bullet / dash
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-ink">
      {block.items.map((item) => (
        <li key={item.lineIndex} className="flex gap-2.5">
          <span className="w-4 shrink-0 text-ink-soft">{LIST_MARKER[block.kind as 'bullet' | 'dash']}</span>
          <span className="whitespace-pre-wrap">{item.content}</span>
        </li>
      ))}
    </ul>
  )
}
