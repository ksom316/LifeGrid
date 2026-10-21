import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/focus', label: 'Focus' },
  { to: '/focus/history', label: 'History' },
  { to: '/focus/reviews', label: 'Reviews' },
]

export function TabNav() {
  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Focus & Reviews sections">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            `border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'border-brand text-brand-ink'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
