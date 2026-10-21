import { useAppData } from '../../state/AppDataContext'
import { formatFriendlyDate, greetingForHour, isOverdue, isToday } from '../../utils/date'
import { IconCalendar } from '../ui/icons'

export function GreetingHeader() {
  const now = new Date()
  const { tasks } = useAppData()
  const dueNow = tasks.filter(
    (t) => t.status !== 'done' && (t.priority === 'high' || (t.dueDate && (isToday(t.dueDate) || isOverdue(t.dueDate)))),
  ).length

  return (
    <div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-6 md:flex-row md:items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{greetingForHour(now)}</h1>
        <p className="mt-1 text-xs text-ink-soft">
          {dueNow === 0 ? (
            'Nothing urgent on the board.'
          ) : (
            <>
              You have <span className="font-medium text-ink">{dueNow} priority {dueNow === 1 ? 'task' : 'tasks'}</span>{' '}
              needing attention today.
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-3 self-start rounded-xl border border-border bg-chrome p-2.5 md:self-auto">
        <div className="rounded-lg border border-brand/20 bg-brand/10 p-2 text-brand-ink">
          <IconCalendar width={20} height={20} />
        </div>
        <div className="pr-1">
          <div className="text-xs font-bold text-ink">{formatFriendlyDate(now)}</div>
          <div className="text-[10px] text-ink-soft">Today</div>
        </div>
      </div>
    </div>
  )
}
