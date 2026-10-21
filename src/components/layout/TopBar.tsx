import { IconMenu, IconSearch } from '../ui/icons'

interface TopBarProps {
  onMenuClick: () => void
  onOpenSearch: () => void
}

export function TopBar({ onMenuClick, onOpenSearch }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-sm lg:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="rounded-md p-1.5 text-ink-soft hover:bg-surface-hover hover:text-ink"
      >
        <IconMenu />
      </button>
      <div className="flex items-center gap-2">
        <div className="grid h-5 w-5 grid-cols-2 gap-0.5 rounded-sm bg-gradient-to-br from-brand to-brand-ink p-0.5">
          <span className="rounded-[1px] bg-white/90" />
          <span className="rounded-[1px] bg-white/50" />
          <span className="rounded-[1px] bg-white/50" />
          <span className="rounded-[1px] bg-white/90" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-ink">Life Grid</span>
      </div>
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Open search"
        className="ml-auto rounded-md p-1.5 text-ink-soft hover:bg-surface-hover hover:text-ink"
      >
        <IconSearch width={18} height={18} />
      </button>
    </header>
  )
}
