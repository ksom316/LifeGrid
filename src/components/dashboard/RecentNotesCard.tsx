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
        <ul className="flex flex-col gap-2">
          {recent.map((note) => (
            <li key={note.id}>
              <Link
                to={`/vault/${note.id}`}
                className="block rounded-lg border border-border bg-canvas px-2.5 py-2.5 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <p className="truncate text-xs font-medium text-ink">{note.title}</p>
                {note.content && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-soft">{note.content}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
