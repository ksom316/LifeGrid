import { NavLink } from 'react-router-dom'
import { IconBook, IconFolder, IconHome, IconSearch, IconSettings, IconTimer, IconX } from '../ui/icons'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconHome },
  { to: '/projects', label: 'Projects', icon: IconFolder },
  { to: '/vault', label: 'Knowledge Vault', icon: IconBook },
  { to: '/focus', label: 'Focus & Reviews', icon: IconTimer },
  { to: '/settings', label: 'Settings', icon: IconSettings },
]

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent)
const SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl K'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onOpenSearch: () => void
}

export function Sidebar({ isOpen, onClose, onOpenSearch }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-border bg-surface transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 grid-cols-2 gap-0.5">
              <span className="rounded-[2px] bg-brand" />
              <span className="rounded-[2px] bg-brand/60" />
              <span className="rounded-[2px] bg-brand/60" />
              <span className="rounded-[2px] bg-brand" />
            </div>
            <span className="text-sm font-semibold text-ink">Life Grid</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-1 text-ink-soft hover:bg-canvas lg:hidden"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenSearch()
            }}
            aria-label="Open search"
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-ink-soft transition-colors hover:border-brand hover:text-ink"
          >
            <IconSearch width={16} height={16} />
            <span className="flex-1 text-left">Search</span>
            <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
              {SHORTCUT_LABEL}
            </kbd>
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3" aria-label="Primary">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-soft text-brand-ink'
                    : 'text-ink-soft hover:bg-canvas hover:text-ink'
                }`
              }
            >
              <Icon width={18} height={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
