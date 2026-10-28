import { describe, expect, it } from 'vitest'
import { tokenizeCode } from './codeHighlight'

function reconstruct(code: string): string {
  return tokenizeCode(code)
    .map((t) => t.text)
    .join('')
}

describe('tokenizeCode', () => {
  it('never loses or alters a single character — tokens concatenate back to the exact input', () => {
    const samples = [
      'const x = { "key": "value\'s here", arr: [1,2,3] };',
      'def f(x):\n    return x + 1  # comment',
      "SELECT * FROM users WHERE id = 'abc' AND active = 1;",
      '{"a": 1, "b": [true, false, null]}',
      '#!/bin/bash\nfor f in *.txt; do\n  echo "$f"\ndone',
      '/* block\n   comment */\nvar y = 2;',
      '\t\tindented\twith\ttabs',
      'unicode: café — “smart quotes” and emoji 🎉',
    ]
    for (const code of samples) {
      expect(reconstruct(code)).toBe(code)
    }
  })

  it('tags a line comment', () => {
    const tokens = tokenizeCode('// a comment')
    expect(tokens[0]).toEqual({ text: '// a comment', type: 'comment' })
  })

  it('tags a double-quoted string including escaped quotes', () => {
    const tokens = tokenizeCode('"a \\"quoted\\" string"')
    expect(tokens[0].type).toBe('string')
    expect(tokens[0].text).toBe('"a \\"quoted\\" string"')
  })

  it('tags a known keyword', () => {
    const tokens = tokenizeCode('const')
    expect(tokens[0]).toEqual({ text: 'const', type: 'keyword' })
  })

  it('does not tag an ordinary identifier as a keyword', () => {
    const tokens = tokenizeCode('myVariable')
    expect(tokens[0]).toEqual({ text: 'myVariable', type: 'plain' })
  })

  it('tags a number', () => {
    const tokens = tokenizeCode('42')
    expect(tokens[0]).toEqual({ text: '42', type: 'number' })
  })
})
