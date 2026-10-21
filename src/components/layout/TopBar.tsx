import { useAppData } from '../../state/AppDataContext'
import { IconMenu, IconSearch } from '../ui/icons'

interface TopBarProps {
  onMenuClick: () => void
  onOpenSearch: () => void
}

export function TopBar({ onMenuClick, onOpenSearch }: TopBarProps) {
  const { dataSource } = useAppData()

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-chrome/90 px-4 py-3 backdrop-blur-sm lg:px-8 lg:py-3.5">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-hover hover:text-ink lg:hidden"
      >
        <IconMenu />
      </button>

      <div className="flex items-center gap-2 lg:hidden">
        <div className="grid h-5 w-5 grid-cols-2 gap-0.5 rounded-sm bg-gradient-to-br from-brand to-brand-ink p-0.5">
          <span className="rounded-[1px] bg-white/90" />
          <span className="rounded-[1px] bg-white/50" />
          <span className="rounded-[1px] bg-white/50" />
          <span className="rounded-[1px] bg-white/90" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-ink">Life Grid</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-border-strong hover:text-ink lg:flex"
        >
          <IconSearch width={14} height={14} />
          Search…
          <kbd className="rounded border border-border-strong bg-canvas px-1 py-0.5 text-[10px] text-muted">
            Ctrl K
          </kbd>
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-hover hover:text-ink lg:hidden"
        >
          <IconSearch width={18} height={18} />
        </button>
        <span
          className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted lg:flex"
          title={dataSource === 'hosted' ? 'Synced to your account' : 'Private & local-first'}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${dataSource === 'hosted' ? 'bg-success' : 'bg-muted'}`}
            aria-hidden="true"
          />
          {dataSource === 'hosted' ? 'Synced' : 'Local'}
        </span>
      </div>
    </header>
  )
}
