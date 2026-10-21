import { Link } from 'react-router-dom'
import { useAppData } from '../../state/AppDataContext'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { IconBook } from '../ui/icons'

export function RecentNotesCard() {
  const { notes } = useAppData()
  const recent = [...notes]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 4)

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <IconBook width={14} height={14} className="text-brand-ink" />
          Recent notes
        </span>
      }
    >
      {recent.length === 0 ? (
        <EmptyState
          icon={<IconBook width={28} height={28} />}
          title="No notes yet"
          description="Capture ideas, references, or research in the Knowledge Vault."
        />
      ) : (
        <ul className="-mx-2 flex flex-col divide-y divide-border">
          {recent.map((note) => (
            <li key={note.id}>
              <Link
                to={`/vault/${note.id}`}
                className="block rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <p className="truncate text-sm font-medium text-ink">{note.title}</p>
                {note.content && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{note.content}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
