/**
 * A small, dependency-free, generic syntax highlighter. It never parses a
 * real language grammar and never evaluates anything — it just tokenizes
 * code text with one regex pass (comments, strings, numbers, a merged
 * keyword set) so common snippets (JS, Python, SQL, JSON, shell, config
 * files) get reasonable color-coding without pulling in a highlighting
 * library. Good enough for a note attachment, not a claim of full
 * language-aware correctness.
 */

export type TokenType = 'comment' | 'string' | 'number' | 'keyword' | 'plain'

export interface CodeToken {
  text: string
  type: TokenType
}

const KEYWORDS = new Set([
  // JS/TS
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
  'break', 'continue', 'class', 'extends', 'new', 'this', 'import', 'export', 'from', 'default',
  'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'null', 'undefined',
  'true', 'false', 'void', 'yield', 'static', 'get', 'set',
  // Python
  'def', 'elif', 'except', 'lambda', 'pass', 'raise', 'with', 'as', 'is', 'not', 'in', 'and', 'or',
  'None', 'True', 'False', 'self', 'print',
  // SQL
  'select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'join', 'inner',
  'left', 'right', 'on', 'group', 'by', 'order', 'having', 'create', 'table', 'alter', 'drop', 'index',
  'primary', 'key', 'references', 'not', 'null', 'default', 'and', 'or',
  // Shell
  'echo', 'export', 'cd', 'sudo', 'if', 'then', 'fi', 'done', 'do',
])

// One alternation covering, in priority order: line comments, block
// comments, strings (single/double/backtick, escape-aware), and numbers.
// Everything that doesn't match falls through as a plain word/symbol run.
const TOKEN_RE =
  /(\/\/[^\n]*|#[^\n]*|--[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+\.?\d*\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_]+)/g

export function tokenizeCode(code: string): CodeToken[] {
  const tokens: CodeToken[] = []
  TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN_RE.exec(code))) {
    const [, lineComment, blockComment, string, number, word, space, symbol] = match
    if (lineComment !== undefined || blockComment !== undefined) {
      tokens.push({ text: lineComment ?? blockComment, type: 'comment' })
    } else if (string !== undefined) {
      tokens.push({ text: string, type: 'string' })
    } else if (number !== undefined) {
      tokens.push({ text: number, type: 'number' })
    } else if (word !== undefined) {
      tokens.push({ text: word, type: KEYWORDS.has(word) ? 'keyword' : 'plain' })
    } else {
      tokens.push({ text: space ?? symbol ?? '', type: 'plain' })
    }
  }
  return tokens
}
