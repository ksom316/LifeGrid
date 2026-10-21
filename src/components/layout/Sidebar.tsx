import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import { BrandMark } from './BrandMark'
import { IconBook, IconFolder, IconHome, IconSettings, IconTimer, IconX } from '../ui/icons'

interface NavItem {
  to: string
  label: string
  icon: typeof IconHome
  count?: string
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { dataSource, projects, notes } = useAppData()
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const activeProjects = projects.filter((p) => p.status === 'active').length

  const coreItems: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: IconHome },
    {
      to: '/projects',
      label: 'Projects',
      icon: IconFolder,
      count: activeProjects > 0 ? `${activeProjects} Active` : undefined,
    },
    {
      to: '/vault',
      label: 'Knowledge Vault',
      icon: IconBook,
      count: notes.length > 0 ? String(notes.length) : undefined,
    },
    { to: '/focus', label: 'Focus & Reviews', icon: IconTimer },
  ]
  const systemItems: NavItem[] = [{ to: '/settings', label: 'Settings', icon: IconSettings }]

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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col justify-between border-r border-border bg-chrome transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'invisible -translate-x-full lg:visible'
        }`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex h-16 items-center justify-between border-b border-border/60 px-5">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <p className="text-sm font-semibold tracking-wide text-ink">Life Grid</p>
                <p className="text-[10px] font-medium tracking-wider text-ink-soft uppercase">Command OS</p>
              </div>
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

          <nav className="space-y-6 p-3" aria-label="Primary">
            <NavSection label="Core Views" items={coreItems} onClose={onClose} />
            <NavSection label="System" items={systemItems} onClose={onClose} />
          </nav>
        </div>

        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${dataSource === 'hosted' ? 'bg-success' : 'bg-muted'}`}
              aria-hidden="true"
            />
            <div className="text-left">
              <p className="text-xs leading-none font-medium text-ink">
                {dataSource === 'hosted' ? 'Synced' : 'Not synced'}
              </p>
              <p className="mt-1 text-[10px] leading-none text-ink-soft">
                {dataSource === 'hosted' ? 'Synced to your account' : 'Saved only in this browser'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function NavSection({
  label,
  items,
  onClose,
}: {
  label: string
  items: NavItem[]
  onClose: () => void
}) {
  return (
    <div>
      <div className="mb-2 px-3 text-[10px] font-semibold tracking-wider text-ink-soft uppercase">
        {label}
      </div>
      <ul className="space-y-1">
        {items.map(({ to, label: itemLabel, icon: Icon, count }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all ${
                  isActive
                    ? 'border-brand/20 bg-brand/10 font-medium text-brand-ink'
                    : 'border-transparent text-ink-soft hover:bg-surface-hover hover:text-ink'
                }`
              }
            >
              <span className="flex items-center gap-2.5">
                <Icon width={16} height={16} />
                {itemLabel}
              </span>
              {count && (
                <span aria-hidden="true" className="text-xs text-ink-soft">
                  {count}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
