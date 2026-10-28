import { describe, expect, it } from 'vitest'
import {
  applyIndent,
  applyListFormat,
  handleListEnter,
  isInsideCodeFence,
  parseLine,
  renumberAllLists,
  toggleChecklistLine,
  toggleCodeBlock,
} from './noteFormatting'

describe('parseLine', () => {
  it('recognizes a bullet line', () => {
    expect(parseLine('• Milk')).toEqual({ indent: '', kind: 'bullet', content: 'Milk' })
  })

  it('recognizes a dash line', () => {
    expect(parseLine('– Eggs')).toEqual({ indent: '', kind: 'dash', content: 'Eggs' })
  })

  it('recognizes a numbered line', () => {
    expect(parseLine('3. Third step')).toEqual({ indent: '', kind: 'numbered', content: 'Third step' })
  })

  it('recognizes an unchecked checklist line', () => {
    expect(parseLine('[ ] Buy milk')).toEqual({ indent: '', kind: 'checklist', content: 'Buy milk', checked: false })
  })

  it('recognizes a checked checklist line', () => {
    expect(parseLine('[x] Buy milk')).toEqual({ indent: '', kind: 'checklist', content: 'Buy milk', checked: true })
  })

  it('preserves leading indentation', () => {
    expect(parseLine('  • Nested')).toEqual({ indent: '  ', kind: 'bullet', content: 'Nested' })
  })

  it('returns null for plain prose', () => {
    expect(parseLine('Just a sentence.')).toBeNull()
  })

  it('does not misfire on prose that merely starts with a hyphen', () => {
    // A plain hyphen-minus "-" is not the en dash "–" marker; this must not
    // auto-convert ordinary text into a list (explicit requirement).
    expect(parseLine('- not a dash marker')).toBeNull()
  })
})

describe('applyListFormat', () => {
  it('adds a bullet marker to a single line with a collapsed cursor', () => {
    const result = applyListFormat('Milk', 0, 0, 'bullet')
    expect(result.text).toBe('• Milk')
  })

  it('adds a marker when the note is completely empty (regression: a blank line was vacuously "already this kind")', () => {
    // Clicking a list-style toolbar button on a brand-new, empty note must
    // actually insert the marker — a single blank line has no marker to
    // toggle off, so it must never be treated as "already formatted."
    expect(applyListFormat('', 0, 0, 'checklist').text).toBe('[ ] ')
    expect(applyListFormat('', 0, 0, 'bullet').text).toBe('• ')
    expect(applyListFormat('', 0, 0, 'dash').text).toBe('– ')
    expect(applyListFormat('', 0, 0, 'numbered').text).toBe('1. ')
  })

  it('treats a blank line within a multi-line selection as compatible with any kind, not as a mismatch', () => {
    const text = '• Milk\n\n• Eggs'
    const result = applyListFormat(text, 0, text.length, 'bullet')
    // Already all-bullet aside from the blank separator line — toggles off.
    expect(result.text).toBe('Milk\n\nEggs')
  })

  it('adds dash markers to every line touched by a multi-line selection', () => {
    const text = 'Milk\nEggs\nBread'
    const result = applyListFormat(text, 0, text.length, 'dash')
    expect(result.text).toBe('– Milk\n– Eggs\n– Bread')
  })

  it('numbers a multi-line selection sequentially starting at 1', () => {
    const text = 'First\nSecond\nThird'
    const result = applyListFormat(text, 0, text.length, 'numbered')
    expect(result.text).toBe('1. First\n2. Second\n3. Third')
  })

  it('creates unchecked checklist items', () => {
    const result = applyListFormat('Buy milk', 0, 0, 'checklist')
    expect(result.text).toBe('[ ] Buy milk')
  })

  it('toggles the same marker off when every touched line already has it', () => {
    const text = '• Milk\n• Eggs'
    const result = applyListFormat(text, 0, text.length, 'bullet')
    expect(result.text).toBe('Milk\nEggs')
  })

  it('switches a line from one list kind to another instead of stacking markers', () => {
    const result = applyListFormat('• Milk', 0, 0, 'numbered')
    expect(result.text).toBe('1. Milk')
  })

  it('keeps the cursor positioned after the inserted marker for a collapsed selection', () => {
    const result = applyListFormat('Milk', 4, 4, 'bullet')
    // "• " is 2 characters, so a cursor that was at the end of "Milk" (4)
    // should now be at the end of "• Milk" (6).
    expect(result.selectionStart).toBe(6)
    expect(result.selectionEnd).toBe(6)
  })
})

describe('applyIndent', () => {
  it('adds two leading spaces to the selected line', () => {
    const result = applyIndent('Milk', 0, 0, 'in')
    expect(result.text).toBe('  Milk')
  })

  it('removes up to two leading spaces when outdenting', () => {
    const result = applyIndent('  Milk', 0, 0, 'out')
    expect(result.text).toBe('Milk')
  })

  it('outdenting a line with no leading space is a no-op', () => {
    const result = applyIndent('Milk', 0, 0, 'out')
    expect(result.text).toBe('Milk')
  })

  it('indents every line in a multi-line selection', () => {
    const text = '• Milk\n• Eggs'
    const result = applyIndent(text, 0, text.length, 'in')
    expect(result.text).toBe('  • Milk\n  • Eggs')
  })
})

describe('toggleCodeBlock', () => {
  it('wraps the current line in a fenced code block', () => {
    const result = toggleCodeBlock('const x = 1', 0, 0)
    expect(result.text).toBe('```\nconst x = 1\n```')
  })

  it('wraps a multi-line selection preserving internal whitespace exactly', () => {
    const code = 'function f() {\n  return 1;\n}'
    const result = toggleCodeBlock(code, 0, code.length)
    expect(result.text).toBe('```\nfunction f() {\n  return 1;\n}\n```')
  })

  it('preserves surrounding prose when wrapping a middle selection', () => {
    const text = 'Before\ncode here\nAfter'
    const result = toggleCodeBlock(text, 7, 16)
    expect(result.text).toBe('Before\n```\ncode here\n```\nAfter')
  })

  it('unwraps a fenced block back to plain lines', () => {
    const fenced = '```\nconst x = 1\n```'
    const result = toggleCodeBlock(fenced, 4, 15)
    expect(result.text).toBe('const x = 1')
  })

  it('preserves quotes, braces, and special characters inside a code block untouched', () => {
    const code = 'const obj = { "key": "value\'s here", arr: [1,2,3] };'
    const result = toggleCodeBlock(code, 0, code.length)
    expect(result.text).toContain(code)
  })
})

describe('isInsideCodeFence', () => {
  it('is false before any fence', () => {
    expect(isInsideCodeFence('plain text', 3)).toBe(false)
  })

  it('is true between an opening and closing fence', () => {
    const text = '```\ncode\n```'
    const insideIndex = text.indexOf('code')
    expect(isInsideCodeFence(text, insideIndex)).toBe(true)
  })

  it('is false after a closing fence', () => {
    const text = '```\ncode\n```\nafter'
    const afterIndex = text.indexOf('after')
    expect(isInsideCodeFence(text, afterIndex)).toBe(false)
  })
})

describe('handleListEnter', () => {
  it('continues a bullet list on Enter', () => {
    const text = '• Milk'
    const result = handleListEnter(text, text.length)
    expect(result.handled).toBe(true)
    expect(result.text).toBe('• Milk\n• ')
    expect(result.selectionStart).toBe(result.text.length)
  })

  it('continues a dash list on Enter', () => {
    const text = '– Milk'
    const result = handleListEnter(text, text.length)
    expect(result.text).toBe('– Milk\n– ')
  })

  it('continues a checklist on Enter with a fresh unchecked item', () => {
    const text = '[x] Milk'
    const result = handleListEnter(text, text.length)
    expect(result.text).toBe('[x] Milk\n[ ] ')
  })

  it('increments the number when continuing a numbered list', () => {
    const text = '1. First'
    const result = handleListEnter(text, text.length)
    expect(result.text).toBe('1. First\n2. ')
  })

  it('renumbers the whole run when Enter inserts a new item in the middle', () => {
    const text = '1. First\n2. Second'
    const cursor = '1. First'.length
    const result = handleListEnter(text, cursor)
    expect(result.text).toBe('1. First\n2. \n3. Second')
  })

  it('exits the list when Enter is pressed on an already-empty item', () => {
    const text = '• Milk\n• '
    const result = handleListEnter(text, text.length)
    expect(result.handled).toBe(true)
    expect(result.text).toBe('• Milk\n')
  })

  it('does not treat plain prose as a list on Enter', () => {
    const text = 'Just a sentence'
    const result = handleListEnter(text, text.length)
    expect(result.handled).toBe(false)
  })

  it('does not apply list continuation inside a code fence', () => {
    const text = '```\n• not a list, just code\n```'
    const cursor = text.indexOf('code') + 4
    const result = handleListEnter(text, cursor)
    expect(result.handled).toBe(false)
  })
})

describe('renumberAllLists', () => {
  it('renumbers after a line is deleted from the middle', () => {
    const text = '1. First\n3. Third\n4. Fourth' // "2." was deleted along with its line
    expect(renumberAllLists(text)).toBe('1. First\n2. Third\n3. Fourth')
  })

  it('renumbers after lines are reordered', () => {
    const text = '1. Second\n2. First' // swapped out of source order
    expect(renumberAllLists(text)).toBe('1. Second\n2. First')
  })

  it('renumbers each contiguous run independently, separated by other content', () => {
    const text = '1. A\n2. B\n\nnote in between\n\n1. X\n2. Y\n3. Z'
    expect(renumberAllLists(text)).toBe('1. A\n2. B\n\nnote in between\n\n1. X\n2. Y\n3. Z')
  })

  it('fixes numbers that are out of sequence after manual edits', () => {
    const text = '1. A\n5. B\n5. C'
    expect(renumberAllLists(text)).toBe('1. A\n2. B\n3. C')
  })
})

describe('toggleChecklistLine', () => {
  it('checks an unchecked item', () => {
    const result = toggleChecklistLine('[ ] Buy milk', 0)
    expect(result).toBe('[x] Buy milk')
  })

  it('unchecks a checked item', () => {
    const result = toggleChecklistLine('[x] Buy milk', 0)
    expect(result).toBe('[ ] Buy milk')
  })

  it('only toggles the targeted line among several', () => {
    const text = '[ ] One\n[ ] Two\n[ ] Three'
    const result = toggleChecklistLine(text, 1)
    expect(result).toBe('[ ] One\n[x] Two\n[ ] Three')
  })

  it('is a no-op on a non-checklist line', () => {
    const result = toggleChecklistLine('Just prose', 0)
    expect(result).toBe('Just prose')
  })
})
