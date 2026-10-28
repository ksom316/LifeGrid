/**
 * Plain-text block formatting for the note editor. Notes are stored as an
 * ordinary string (see Note.content in src/types/domain.ts) — nothing here
 * changes that. These helpers just insert/remove recognizable line-prefix
 * markers into that same string, and a small scan recognizes them back out
 * for rendering (see noteRenderer.tsx). A note with none of these markers
 * is untouched plain prose, identical to what the app stored before this
 * existed — that's what keeps every existing note fully compatible.
 */

export type ListKind = 'bullet' | 'dash' | 'numbered' | 'checklist'

export interface ParsedLine {
  indent: string
  kind: ListKind
  content: string
  checked?: boolean
}

const BULLET_RE = /^(\s*)• (.*)$/
const DASH_RE = /^(\s*)– (.*)$/
const NUMBERED_RE = /^(\s*)(\d+)\. (.*)$/
const CHECKLIST_RE = /^(\s*)\[([ xX])\] (.*)$/
/** Matches a fence line exactly: ``` optionally followed by a language tag. */
export const CODE_FENCE_RE = /^```[^`]*$/

/** Recognizes which (if any) list marker a line starts with. */
export function parseLine(line: string): ParsedLine | null {
  let m = line.match(CHECKLIST_RE)
  if (m) return { indent: m[1], kind: 'checklist', content: m[3], checked: m[2].toLowerCase() === 'x' }
  m = line.match(NUMBERED_RE)
  if (m) return { indent: m[1], kind: 'numbered', content: m[3] }
  m = line.match(BULLET_RE)
  if (m) return { indent: m[1], kind: 'bullet', content: m[2] }
  m = line.match(DASH_RE)
  if (m) return { indent: m[1], kind: 'dash', content: m[2] }
  return null
}

function markerFor(kind: ListKind, number: number, checked = false): string {
  switch (kind) {
    case 'bullet':
      return '• '
    case 'dash':
      return '– '
    case 'numbered':
      return `${number}. `
    case 'checklist':
      return `[${checked ? 'x' : ' '}] `
  }
}

/** Strips a recognized marker, keeping only the indent and text. */
function bareLine(line: string): { indent: string; content: string } {
  const parsed = parseLine(line)
  return parsed ? { indent: parsed.indent, content: parsed.content } : { indent: '', content: line }
}

/** True while `index` falls inside a fenced code block (odd number of fence lines strictly before it). */
export function isInsideCodeFence(text: string, index: number): boolean {
  const before = text.slice(0, index).split('\n')
  let fences = 0
  for (const line of before) {
    if (CODE_FENCE_RE.test(line.trim())) fences++
  }
  return fences % 2 === 1
}

interface LineSpan {
  lines: string[]
  /** Index of the first/last affected line within the full text's line array. */
  startLine: number
  endLine: number
}

function linesInSelection(text: string, start: number, end: number): LineSpan {
  const lines = text.split('\n')
  const offsets: number[] = []
  let pos = 0
  for (const line of lines) {
    offsets.push(pos)
    pos += line.length + 1
  }
  let startLine = 0
  let endLine = lines.length - 1
  for (let i = 0; i < lines.length; i++) {
    const lineStart = offsets[i]
    const lineEnd = lineStart + lines[i].length
    if (start >= lineStart && start <= lineEnd) startLine = i
    if (end >= lineStart && end <= lineEnd) endLine = i
  }
  return { lines, startLine, endLine }
}

export interface FormatResult {
  text: string
  selectionStart: number
  selectionEnd: number
}

/**
 * Toggles a list marker on every line the selection touches (or just the
 * current line, for a collapsed cursor). If every touched line already has
 * that exact marker kind, it's removed instead (toggle off). Switching a
 * line from one list kind to another replaces its marker rather than
 * stacking two.
 */
export function applyListFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  kind: ListKind,
): FormatResult {
  const { lines, startLine, endLine } = linesInSelection(text, selectionStart, selectionEnd)
  const touched = lines.slice(startLine, endLine + 1)
  // Blank lines don't carry a marker either way, so they're ignored when
  // deciding "is this selection already formatted" — but if EVERY touched
  // line is blank (the empty-note case: one blank line, nothing typed
  // yet), there is nothing to toggle off, so that must count as "not
  // already this kind" or clicking the toolbar on a fresh note would be a
  // silent no-op.
  const nonBlankTouched = touched.filter((line) => line.trim() !== '')
  const allAlreadyThisKind =
    nonBlankTouched.length > 0 && nonBlankTouched.every((line) => parseLine(line)?.kind === kind)

  let number = 1
  // Per-line length delta, so the caret/selection can be shifted by exactly
  // what changed on each line rather than guessed from the overall total.
  const deltas: number[] = []
  const next = lines.map((line, i) => {
    if (i < startLine || i > endLine) {
      deltas.push(0)
      return line
    }
    const { indent, content } = bareLine(line)
    if (allAlreadyThisKind) {
      const replaced = content === '' && indent === '' ? line : content
      deltas.push(replaced.length - line.length)
      return replaced
    }
    const marker = markerFor(kind, number, false)
    if (kind === 'numbered') number++
    const replaced = `${indent}${marker}${content}`
    deltas.push(replaced.length - line.length)
    return replaced
  })

  // Every marker change happens at the very start of its line (prepended or
  // stripped from the front), so a position within that line shifts by that
  // line's own delta too, not just by the deltas of lines strictly before
  // it — hence slice(0, lineIndex + 1), inclusive of the line itself.
  const deltaBefore = (lineIndex: number) => deltas.slice(0, lineIndex + 1).reduce((a, b) => a + b, 0)
  const shift = (original: number, lineIndex: number) => {
    const base = deltaBefore(lineIndex)
    return Math.max(0, original + base)
  }

  return {
    text: next.join('\n'),
    selectionStart: shift(selectionStart, startLine),
    selectionEnd: shift(selectionEnd, endLine),
  }
}

/** Indents (adds) or outdents (removes) two leading spaces on every selected line. */
export function applyIndent(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  direction: 'in' | 'out',
): FormatResult {
  const { lines, startLine, endLine } = linesInSelection(text, selectionStart, selectionEnd)
  let startDelta = 0
  let totalDelta = 0
  const next = lines.map((line, i) => {
    if (i < startLine || i > endLine) return line
    if (direction === 'in') {
      totalDelta += 2
      if (i === startLine) startDelta += 2
      return `  ${line}`
    }
    const removed = line.match(/^ {1,2}/)?.[0].length ?? 0
    totalDelta -= removed
    if (i === startLine) startDelta -= removed
    return line.slice(removed)
  })
  return {
    text: next.join('\n'),
    selectionStart: Math.max(0, selectionStart + startDelta),
    selectionEnd: Math.max(0, selectionEnd + totalDelta),
  }
}

/**
 * Wraps the selected lines (or current line) in a fenced code block, or
 * unwraps them if the selection sits exactly on an existing fence pair.
 */
export function toggleCodeBlock(text: string, selectionStart: number, selectionEnd: number): FormatResult {
  const { lines, startLine, endLine } = linesInSelection(text, selectionStart, selectionEnd)

  const lineBefore = startLine > 0 ? lines[startLine - 1] : undefined
  const lineAfter = endLine < lines.length - 1 ? lines[endLine + 1] : undefined
  if (lineBefore !== undefined && lineAfter !== undefined && CODE_FENCE_RE.test(lineBefore) && CODE_FENCE_RE.test(lineAfter)) {
    const next = [...lines.slice(0, startLine - 1), ...lines.slice(startLine, endLine + 1), ...lines.slice(endLine + 2)]
    // Only the opening fence (removed from before startLine) shifts
    // positions within the selected range; the closing fence is removed
    // from after endLine, so it can't affect either endpoint.
    const removedBefore = lineBefore.length + 1
    return {
      text: next.join('\n'),
      selectionStart: Math.max(0, selectionStart - removedBefore),
      selectionEnd: Math.max(0, selectionEnd - removedBefore),
    }
  }

  const before = lines.slice(0, startLine).join('\n')
  const middle = lines.slice(startLine, endLine + 1).join('\n')
  const after = lines.slice(endLine + 1).join('\n')
  const prefix = before ? `${before}\n` : ''
  const suffix = after ? `\n${after}` : ''
  const wrapped = `${prefix}\`\`\`\n${middle}\n\`\`\`${suffix}`
  const newStart = prefix.length + 4
  return { text: wrapped, selectionStart: newStart, selectionEnd: newStart + middle.length }
}

export interface EnterResult extends FormatResult {
  /** False means "let the textarea handle Enter normally" (plain paragraph, or inside a code fence). */
  handled: boolean
}

/**
 * Decides what Enter should do at the given cursor position (no selection):
 * continue the current list item with a fresh marker, renumber a numbered
 * list, exit the list when the current item is already empty, or do
 * nothing special (plain newline) in prose or inside a code fence — code
 * fences never get automatic list behavior, by design.
 */
export function handleListEnter(text: string, cursor: number): EnterResult {
  if (isInsideCodeFence(text, cursor)) {
    return { text, selectionStart: cursor, selectionEnd: cursor, handled: false }
  }

  const lineStart = text.lastIndexOf('\n', cursor - 1) + 1
  const lineEnd = text.indexOf('\n', cursor)
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd)
  const beforeCursor = text.slice(lineStart, cursor)
  const parsed = parseLine(beforeCursor) ?? parseLine(line)
  if (!parsed) return { text, selectionStart: cursor, selectionEnd: cursor, handled: false }

  const restOfLine = text.slice(cursor, lineEnd === -1 ? text.length : lineEnd)

  if (parsed.content.trim() === '' && restOfLine.trim() === '') {
    // Enter on an already-empty item exits the list: strip the marker
    // instead of starting yet another empty item.
    const next = text.slice(0, lineStart) + parsed.indent + text.slice(cursor)
    const pos = lineStart + parsed.indent.length
    return { text: next, selectionStart: pos, selectionEnd: pos, handled: true }
  }

  let nextMarker: string
  if (parsed.kind === 'numbered') {
    const currentNumber = Number(line.match(NUMBERED_RE)?.[2] ?? '1')
    nextMarker = markerFor('numbered', currentNumber + 1)
  } else {
    nextMarker = markerFor(parsed.kind, 1)
  }

  const insertion = `\n${parsed.indent}${nextMarker}`
  const next = text.slice(0, cursor) + insertion + text.slice(cursor)
  let result = next
  if (parsed.kind === 'numbered') {
    result = renumberListAt(next, cursor + insertion.length)
  }
  const pos = cursor + insertion.length
  return { text: result, selectionStart: pos, selectionEnd: pos, handled: true }
}

/**
 * Renumbers the maximal contiguous run of numbered-list lines containing
 * `cursor`, in source order, starting at 1 — called after any insertion,
 * deletion, or reordering of numbered items so the displayed numbers never
 * drift out of sequence.
 */
export function renumberListAt(text: string, cursor: number): string {
  const lines = text.split('\n')
  const offsets: number[] = []
  let pos = 0
  for (const line of lines) {
    offsets.push(pos)
    pos += line.length + 1
  }
  let cursorLine = lines.length - 1
  for (let i = 0; i < lines.length; i++) {
    if (cursor >= offsets[i] && cursor <= offsets[i] + lines[i].length) {
      cursorLine = i
      break
    }
  }
  if (!NUMBERED_RE.test(lines[cursorLine])) return text

  let start = cursorLine
  while (start > 0 && NUMBERED_RE.test(lines[start - 1])) start--
  let end = cursorLine
  while (end < lines.length - 1 && NUMBERED_RE.test(lines[end + 1])) end++

  let n = 1
  for (let i = start; i <= end; i++) {
    const m = lines[i].match(NUMBERED_RE)!
    lines[i] = `${m[1]}${n}. ${m[3]}`
    n++
  }
  return lines.join('\n')
}

/** Renumbers every contiguous numbered-list run in the whole text. */
export function renumberAllLists(text: string): string {
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    if (NUMBERED_RE.test(lines[i])) {
      let n = 1
      while (i < lines.length && NUMBERED_RE.test(lines[i])) {
        const m = lines[i].match(NUMBERED_RE)!
        lines[i] = `${m[1]}${n}. ${m[3]}`
        n++
        i++
      }
    } else {
      i++
    }
  }
  return lines.join('\n')
}

/** Toggles a checklist line's checked state by line index (0-based, within the whole note). */
export function toggleChecklistLine(text: string, lineIndex: number): string {
  const lines = text.split('\n')
  const line = lines[lineIndex]
  if (line === undefined) return text
  const parsed = parseLine(line)
  if (!parsed || parsed.kind !== 'checklist') return text
  lines[lineIndex] = `${parsed.indent}[${parsed.checked ? ' ' : 'x'}] ${parsed.content}`
  return lines.join('\n')
}
