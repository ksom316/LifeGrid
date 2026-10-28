import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  applyIndent,
  applyListFormat,
  handleListEnter,
  renumberAllLists,
  toggleCodeBlock,
} from '../../utils/noteFormatting'
import type { ListKind } from '../../utils/noteFormatting'
import { inputClasses } from '../ui/Field'
import {
  IconChevronDown,
  IconCode,
  IconIndentDecrease,
  IconIndentIncrease,
  IconListBullet,
  IconListCheck,
  IconListDash,
  IconListNumbered,
} from '../ui/icons'

const LIST_OPTIONS: { kind: ListKind; label: string; icon: typeof IconListBullet }[] = [
  { kind: 'bullet', label: 'Bullets (•)', icon: IconListBullet },
  { kind: 'dash', label: 'Dashes (–)', icon: IconListDash },
  { kind: 'numbered', label: 'Numbered (1. 2. 3.)', icon: IconListNumbered },
  { kind: 'checklist', label: 'Checklist', icon: IconListCheck },
]

interface NoteEditorFieldProps {
  id?: string
  value: string
  onChange: (value: string) => void
  autocorrectEnabled: boolean
  onAutocorrectChange: (enabled: boolean) => void
  rows?: number
  placeholder?: string
}

/**
 * A plain <textarea> (the note stays stored as the same plain string it
 * always was — see Note.content) enhanced with a formatting toolbar and
 * keyboard behavior for lists and code blocks. Toolbar actions and Enter/
 * Tab handling just insert or remove the line-marker syntax that
 * src/utils/noteFormatting.ts and noteBlocks.ts read back out for
 * rendering; nothing here depends on a rich-text editing library.
 */
export function NoteEditorField({
  id,
  value,
  onChange,
  autocorrectEnabled,
  onAutocorrectChange,
  rows = 10,
  placeholder,
}: NoteEditorFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [listMenuOpen, setListMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!listMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setListMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [listMenuOpen])

  const applyAndRestoreSelection = (
    formatter: (text: string, start: number, end: number) => { text: string; selectionStart: number; selectionEnd: number },
  ) => {
    const el = textareaRef.current
    if (!el) return
    const result = formatter(value, el.selectionStart, el.selectionEnd)
    commitResult(el, result)
  }

  /**
   * Writes the formatted text straight to the textarea's own DOM value and
   * restores the selection synchronously, then tells React about the
   * change. Doing this via requestAnimationFrame (the first version of
   * this file did) loses a race against fast typing: a real browser
   * dispatches the *next* keystroke before that callback's next-paint
   * delay fires, landing new characters at a stale cursor position
   * instead of where the marker was just inserted. Setting `el.value` and
   * the selection here, before `onChange`, means React's controlled-value
   * re-render is a no-op (the DOM already matches), and the cursor is
   * already correct for whatever the user types next.
   */
  const commitResult = (
    el: HTMLTextAreaElement,
    result: { text: string; selectionStart: number; selectionEnd: number },
  ) => {
    el.value = result.text
    el.focus()
    el.setSelectionRange(result.selectionStart, result.selectionEnd)
    onChange(result.text)
  }

  const handleList = (kind: ListKind) => {
    applyAndRestoreSelection((text, start, end) => applyListFormat(text, start, end, kind))
    setListMenuOpen(false)
  }

  const handleCode = () => {
    applyAndRestoreSelection(toggleCodeBlock)
  }

  const handleIndent = (direction: 'in' | 'out') => {
    applyAndRestoreSelection((text, start, end) => applyIndent(text, start, end, direction))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget

    if (e.key === 'Enter' && el.selectionStart === el.selectionEnd) {
      // Reads el.value (the live DOM value), not the `value` prop — after
      // commitResult's synchronous DOM write, the DOM is always the freshest
      // source during the same keydown-handling pass.
      const result = handleListEnter(el.value, el.selectionStart)
      if (result.handled) {
        e.preventDefault()
        commitResult(el, result)
      }
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      applyAndRestoreSelection((text, start, end) => applyIndent(text, start, end, e.shiftKey ? 'out' : 'in'))
      return
    }

    // Backspace/Delete that removes a list line can leave numbered markers
    // out of sequence; a synchronous renumber pass right after the browser
    // applies the deletion keeps them correct without having to track
    // every edit precisely, and without racing a fast repeated keypress.
    if (e.key === 'Backspace' || e.key === 'Delete') {
      queueMicrotask(() => {
        const current = textareaRef.current
        if (!current) return
        const renumbered = renumberAllLists(current.value)
        if (renumbered !== current.value) {
          const pos = current.selectionStart
          commitResult(current, { text: renumbered, selectionStart: pos, selectionEnd: pos })
        }
      })
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-border bg-canvas p-1">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setListMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={listMenuOpen}
            aria-label="List style"
            title="List style"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-ink-soft transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <IconListBullet width={16} height={16} />
            <IconChevronDown width={12} height={12} />
          </button>
          {listMenuOpen && (
            <div
              role="menu"
              className="absolute top-full left-0 z-10 mt-1 w-48 rounded-lg border border-border-strong bg-surface-raised p-1 shadow-lg"
            >
              {LIST_OPTIONS.map(({ kind, label, icon: Icon }) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  onClick={() => handleList(kind)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink transition-colors hover:bg-surface-hover"
                >
                  <Icon width={15} height={15} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolbarIconButton label="Bullet list" onClick={() => handleList('bullet')} icon={IconListBullet} />
        <ToolbarIconButton label="Dash list" onClick={() => handleList('dash')} icon={IconListDash} />
        <ToolbarIconButton label="Numbered list" onClick={() => handleList('numbered')} icon={IconListNumbered} />
        <ToolbarIconButton label="Checklist" onClick={() => handleList('checklist')} icon={IconListCheck} />

        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

        <ToolbarIconButton label="Code block" onClick={handleCode} icon={IconCode} />
        <ToolbarIconButton label="Indent" onClick={() => handleIndent('in')} icon={IconIndentIncrease} />
        <ToolbarIconButton label="Outdent" onClick={() => handleIndent('out')} icon={IconIndentDecrease} />

        {/* A plain span, not <label>, since this field already sits inside
            the note-content <label> (see Field.tsx) — nested <label>
            elements are invalid HTML and corrupt the accessible name that
            getByLabelText('Content') (and screen readers) compute. The
            checkbox gets its name via aria-label instead. */}
        <span
          className="ml-auto flex cursor-pointer items-center gap-1.5 px-1.5 text-xs text-ink-soft select-none"
          onClick={() => onAutocorrectChange(!autocorrectEnabled)}
        >
          <input
            type="checkbox"
            checked={autocorrectEnabled}
            onChange={(e) => onAutocorrectChange(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Auto-correct"
            className="h-3.5 w-3.5 cursor-pointer rounded border-border-strong accent-brand"
          />
          Auto-correct
        </span>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        className={`${inputClasses} rounded-t-none font-mono`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        spellCheck={autocorrectEnabled}
        autoCapitalize={autocorrectEnabled ? 'sentences' : 'off'}
        autoComplete={autocorrectEnabled ? 'on' : 'off'}
        // autoCorrect is a non-standard but widely respected (Safari/iOS)
        // attribute; React allows arbitrary lowercase DOM attrs only via
        // this cast, since it isn't in the typed JSX attribute set.
        {...({ autoCorrect: autocorrectEnabled ? 'on' : 'off' } as Record<string, string>)}
      />
      {!autocorrectEnabled && (
        <p className="mt-1 text-[11px] text-ink-soft">
          Auto-correct is off for this note. Your browser or operating system may still apply its own
          text replacements — this can't always be overridden from the page.
        </p>
      )}
    </div>
  )
}

function ToolbarIconButton({
  label,
  onClick,
  icon: Icon,
}: {
  label: string
  onClick: () => void
  icon: typeof IconListBullet
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-surface-hover hover:text-ink"
    >
      <Icon width={16} height={16} />
    </button>
  )
}
