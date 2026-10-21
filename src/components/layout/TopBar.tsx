import { useLocation } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import { BrandMark } from './BrandMark'
import { IconMenu, IconSearch } from '../ui/icons'

interface TopBarProps {
  onMenuClick: () => void
  onOpenSearch: () => void
}

const SECTION_LABELS: Record<string, string> = {
  '': 'Command Center',
  projects: 'Projects',
  vault: 'Knowledge Vault',
  focus: 'Focus & Reviews',
  settings: 'Settings',
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent)
const SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl K'

export function TopBar({ onMenuClick, onOpenSearch }: TopBarProps) {
  const { dataSource } = useAppData()
  const { pathname } = useLocation()
  const section = SECTION_LABELS[pathname.split('/')[1] ?? ''] ?? 'Life Grid'

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-chrome/80 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="-ml-1 rounded-lg p-2 text-ink-soft hover:bg-surface-hover hover:text-ink lg:hidden"
      >
        <IconMenu />
      </button>

      <div className="flex items-center gap-2 lg:hidden">
        <BrandMark className="h-6 w-6 p-1" />
        <span className="text-sm font-semibold text-ink">Life Grid</span>
      </div>

      <div className="hidden items-center gap-2 text-xs text-ink-soft lg:flex">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-ink">{section}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="hidden w-64 items-center justify-between rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-border-strong hover:text-ink lg:flex"
        >
          <span className="flex items-center gap-2">
            <IconSearch width={14} height={14} />
            Search workspace...
          </span>
          <kbd className="rounded border border-border bg-chrome px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
            {SHORTCUT_LABEL}
          </kbd>
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="rounded-lg p-2 text-ink-soft hover:bg-surface-hover hover:text-ink lg:hidden"
        >
          <IconSearch width={18} height={18} />
        </button>
        <span
          className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-medium text-ink-soft sm:flex"
          title={dataSource === 'hosted' ? 'Synced to your account' : 'Saved only in this browser'}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${dataSource === 'hosted' ? 'animate-pulse bg-success' : 'bg-muted'}`}
            aria-hidden="true"
          />
          {dataSource === 'hosted' ? 'Synced' : 'Local'}
        </span>
      </div>
    </header>
  )
}
