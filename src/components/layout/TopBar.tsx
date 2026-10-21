import { IconMenu, IconSearch } from '../ui/icons'

interface TopBarProps {
  onMenuClick: () => void
  onOpenSearch: () => void
}

export function TopBar({ onMenuClick, onOpenSearch }: TopBarProps) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="rounded-md p-1.5 text-ink-soft hover:bg-canvas"
      >
        <IconMenu />
      </button>
      <span className="text-sm font-semibold text-ink">Life Grid</span>
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Open search"
        className="ml-auto rounded-md p-1.5 text-ink-soft hover:bg-canvas"
      >
        <IconSearch width={18} height={18} />
      </button>
    </header>
  )
}
