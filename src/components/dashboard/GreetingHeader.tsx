import { formatFriendlyDate, greetingForHour } from '../../utils/date'

export function GreetingHeader() {
  const now = new Date()
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">{greetingForHour(now)}</h1>
      <p className="mt-1 text-sm text-ink-soft">{formatFriendlyDate(now)}</p>
    </div>
  )
}
