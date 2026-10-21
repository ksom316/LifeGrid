import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  /** Overrides the dialog's max-width utility class. Defaults to 'max-w-md'. */
  maxWidthClassName?: string
}

export function Modal({ title, isOpen, onClose, children, maxWidthClassName = 'max-w-md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    // Prefer a text-entry element so forms open ready to type into; only
    // fall back to the first button (e.g. for button-only dialogs like
    // confirmations) when no input/textarea/select is present.
    const dialog = dialogRef.current
    const textEntry = dialog?.querySelector<HTMLElement>('input, textarea, select')
    const fallback = dialog?.querySelector<HTMLElement>('button')
    ;(textEntry ?? fallback)?.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`w-full ${maxWidthClassName} rounded-xl border border-border bg-surface p-5 shadow-xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-ink-soft hover:bg-canvas hover:text-ink cursor-pointer"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
