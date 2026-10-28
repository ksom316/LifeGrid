import { describe, expect, it } from 'vitest'
import { parseNoteBlocks } from './noteBlocks'

describe('parseNoteBlocks', () => {
  it('renders plain prose with no special syntax as a single paragraph block', () => {
    const content = 'Line one.\nLine two.\n\nLine four after a blank line.'
    const blocks = parseNoteBlocks(content)
    expect(blocks).toEqual([{ type: 'paragraph', text: content }])
  })

  it('groups consecutive bullet lines into one list block', () => {
    const blocks = parseNoteBlocks('• Milk\n• Eggs\n• Bread')
    expect(blocks).toEqual([
      {
        type: 'list',
        kind: 'bullet',
        items: [
          { content: 'Milk', checked: undefined, lineIndex: 0 },
          { content: 'Eggs', checked: undefined, lineIndex: 1 },
          { content: 'Bread', checked: undefined, lineIndex: 2 },
        ],
      },
    ])
  })

  it('keeps distinct list kinds as separate blocks', () => {
    const blocks = parseNoteBlocks('• Milk\n1. First\n2. Second')
    expect(blocks).toEqual([
      { type: 'list', kind: 'bullet', items: [{ content: 'Milk', checked: undefined, lineIndex: 0 }] },
      {
        type: 'list',
        kind: 'numbered',
        items: [
          { content: 'First', checked: undefined, lineIndex: 1 },
          { content: 'Second', checked: undefined, lineIndex: 2 },
        ],
      },
    ])
  })

  it('tracks checked state per checklist item', () => {
    const blocks = parseNoteBlocks('[ ] Todo\n[x] Done')
    expect(blocks).toEqual([
      {
        type: 'list',
        kind: 'checklist',
        items: [
          { content: 'Todo', checked: false, lineIndex: 0 },
          { content: 'Done', checked: true, lineIndex: 1 },
        ],
      },
    ])
  })

  it('extracts a fenced code block with its language tag', () => {
    const blocks = parseNoteBlocks('```js\nconst x = 1;\n```')
    expect(blocks).toEqual([{ type: 'code', code: 'const x = 1;', lang: 'js' }])
  })

  it('preserves indentation and blank lines exactly inside a code block', () => {
    const code = 'function f() {\n  if (x) {\n    return 1;\n  }\n}'
    const blocks = parseNoteBlocks('```\n' + code + '\n```')
    expect(blocks).toEqual([{ type: 'code', code, lang: undefined }])
  })

  it('still renders an unterminated code fence rather than dropping its content', () => {
    const blocks = parseNoteBlocks('```\nconst x = 1;')
    expect(blocks).toEqual([{ type: 'code', code: 'const x = 1;', lang: undefined }])
  })

  it('interleaves paragraphs, lists, and code in document order', () => {
    const content = 'Intro text.\n\n• One\n• Two\n\n```\ncode here\n```\n\nOutro text.'
    const blocks = parseNoteBlocks(content)
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'list', 'paragraph', 'code', 'paragraph'])
  })

  it('does not treat a plain hyphen as a dash list marker', () => {
    const blocks = parseNoteBlocks('- just a hyphen, not a dash marker')
    expect(blocks).toEqual([{ type: 'paragraph', text: '- just a hyphen, not a dash marker' }])
  })
})
