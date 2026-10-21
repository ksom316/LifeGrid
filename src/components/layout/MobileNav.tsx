import { NavLink } from 'react-router-dom'
import { IconBook, IconFolder, IconHome, IconSettings, IconTimer } from '../ui/icons'

const ITEMS = [
  { to: '/', label: 'Home', icon: IconHome },
  { to: '/projects', label: 'Projects', icon: IconFolder },
  { to: '/focus', label: 'Focus', icon: IconTimer },
  { to: '/vault', label: 'Vault', icon: IconBook },
  { to: '/settings', label: 'Settings', icon: IconSettings },
]

/** Bottom tab bar for narrow screens; the sidebar drawer stays available from the top bar. */
export function MobileNav() {
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-start justify-around border-t border-border bg-chrome/95 px-2 pt-1.5 backdrop-blur lg:hidden"
    >
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
              isActive ? 'text-brand-ink' : 'text-ink-soft hover:text-ink'
            }`
          }
        >
          <Icon width={18} height={18} />
          <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
