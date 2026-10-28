import { CODE_FENCE_RE, parseLine } from './noteFormatting'
import type { ListKind } from './noteFormatting'

export interface ListItemBlock {
  content: string
  checked?: boolean
  /** Absolute line index in the note's raw content — lets the UI toggle exactly this line. */
  lineIndex: number
}

export type NoteBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; kind: ListKind; items: ListItemBlock[] }
  | { type: 'code'; code: string; lang?: string }

/**
 * Groups a note's raw line-marker syntax (see noteFormatting.ts) into
 * renderable blocks. A note that uses none of that syntax — every note
 * saved before this existed — produces exactly one paragraph block holding
 * the whole original text, which src/components/notes/NoteContent.tsx then
 * renders the same way NoteDetailPage always has (a single `white-space:
 * pre-wrap` block), so old notes are pixel-identical to before.
 */
export function parseNoteBlocks(content: string): NoteBlock[] {
  const lines = content.split('\n')
  const blocks: NoteBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (CODE_FENCE_RE.test(line.trim())) {
      const lang = line.trim().slice(3).trim() || undefined
      const codeLines: string[] = []
      i++
      while (i < lines.length && !CODE_FENCE_RE.test(lines[i].trim())) {
        codeLines.push(lines[i])
        i++
      }
      // Consume the closing fence if present; an unterminated fence at EOF
      // still renders everything collected so far as code rather than
      // dropping it.
      if (i < lines.length) i++
      blocks.push({ type: 'code', code: codeLines.join('\n'), lang })
      continue
    }

    const parsed = parseLine(line)
    if (parsed) {
      const kind = parsed.kind
      const items: ListItemBlock[] = []
      while (i < lines.length) {
        const p = parseLine(lines[i])
        if (!p || p.kind !== kind) break
        items.push({ content: p.content, checked: p.checked, lineIndex: i })
        i++
      }
      blocks.push({ type: 'list', kind, items })
      continue
    }

    const paraLines: string[] = []
    while (i < lines.length && !CODE_FENCE_RE.test(lines[i].trim()) && !parseLine(lines[i])) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', text: paraLines.join('\n') })
  }

  return blocks
}
