import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { IconX } from './icons'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`max-h-[calc(100vh-2rem)] w-full ${maxWidthClassName} overflow-y-auto rounded-xl border border-border bg-surface-raised p-5 shadow-2xl `}
      >
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h2 id="modal-title" className="text-sm font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-hover hover:text-ink cursor-pointer"
          >
            <IconX width={16} height={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
