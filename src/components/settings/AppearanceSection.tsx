import type { ThemePreference } from '../../state/ThemeContext'
import { useTheme } from '../../state/ThemeContext'
import { Card } from '../ui/Card'
import { IconMonitor, IconMoon, IconSun } from '../ui/icons'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof IconSun }[] = [
  { value: 'light', label: 'Light', icon: IconSun },
  { value: 'system', label: 'Default', icon: IconMonitor },
  { value: 'dark', label: 'Dark', icon: IconMoon },
]

export function AppearanceSection() {
  const { theme, setTheme } = useTheme()

  return (
    <Card title="Appearance">
      <p className="mb-4 text-sm text-ink-soft">
        Choose how Life Grid looks on this device. "Default" follows your system's light or dark
        setting automatically.
      </p>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="flex gap-1 rounded-lg border border-border bg-canvas p-1"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = theme === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-surface-raised text-ink shadow-sm ring-1 ring-border-strong'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Icon width={15} height={15} />
              {label}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
