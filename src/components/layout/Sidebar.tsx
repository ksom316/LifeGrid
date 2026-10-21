import { NavLink } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
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
  const { dataSource } = useAppData()

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-chrome transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 grid-cols-2 gap-0.5 rounded-lg bg-gradient-to-br from-brand to-brand-ink p-1 shadow-[0_2px_8px_-2px_var(--color-brand)]">
              <span className="rounded-[2px] bg-white/90" />
              <span className="rounded-[2px] bg-white/50" />
              <span className="rounded-[2px] bg-white/50" />
              <span className="rounded-[2px] bg-white/90" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-ink">Life Grid</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1 text-ink-soft hover:bg-surface-hover lg:hidden"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenSearch()
            }}
            aria-label="Open search"
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink-soft shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-colors hover:border-border-strong hover:text-ink"
          >
            <IconSearch width={16} height={16} />
            <span className="flex-1 text-left">Search</span>
            <kbd className="rounded-md border border-border-strong bg-canvas px-1.5 py-0.5 text-[10px] text-muted">
              {SHORTCUT_LABEL}
            </kbd>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label="Primary">
          <span className="px-3 pb-2 text-[10px] font-semibold tracking-widest text-muted uppercase">
            Workspace
          </span>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-soft text-brand-ink shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                    : 'text-ink-soft hover:bg-surface-hover hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                    aria-hidden="true"
                  />
                  <Icon width={18} height={18} className={isActive ? 'text-brand-ink' : 'text-muted'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 border-t border-border px-5 py-4 text-xs text-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${dataSource === 'hosted' ? 'bg-success' : 'bg-muted'}`}
            aria-hidden="true"
          />
          {dataSource === 'hosted' ? 'Synced to your account' : 'Private & local-first'}
        </div>
      </aside>
    </>
  )
}
