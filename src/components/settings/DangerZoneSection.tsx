import { useId, useState } from 'react'
import { useAppData } from '../../state/AppDataContext'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { inputClasses } from '../ui/Field'

const CONFIRM_PHRASE = 'DELETE'

export function DangerZoneSection() {
  const { hasDemoData, removeSampleData, clearRealData } = useAppData()
  const [removingDemo, setRemovingDemo] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const confirmId = useId()

  const handleRemoveDemo = async () => {
    setRemovingDemo(true)
    try {
      await removeSampleData()
    } finally {
      setRemovingDemo(false)
    }
  }

  const handleClearReal = async () => {
    setClearing(true)
    try {
      await clearRealData()
      setConfirmText('')
      setCleared(true)
    } finally {
      setClearing(false)
    }
  }

  return (
    <Card title="Danger zone">
      <div className="flex flex-col gap-6">
        {hasDemoData && (
          <div>
            <p className="mb-2 text-sm text-ink">Remove sample data</p>
            <p className="mb-3 text-xs text-ink-soft">
              Deletes only records tagged as sample data. Your real projects, tasks, notes, and
              sessions are never touched.
            </p>
            <Button variant="secondary" onClick={handleRemoveDemo} disabled={removingDemo}>
              Remove sample data
            </Button>
          </div>
        )}

        <div className="border-t border-border pt-5">
          <p className="mb-2 text-sm font-medium text-danger">Clear all real data</p>
          <p className="mb-3 text-xs text-ink-soft">
            Permanently deletes every real project, task, note, focus session (including any active
            or paused session), daily plan, and weekly review. Sample data, if loaded, is not
            affected. Export a backup first — this cannot be undone.
          </p>
          {cleared ? (
            <p className="text-sm text-success">Your real data has been cleared.</p>
          ) : (
            <>
              <label htmlFor={confirmId} className="mb-1 block text-xs font-medium text-ink">
                Type {CONFIRM_PHRASE} to confirm
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={confirmId}
                  className={`${inputClasses} w-40`}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                />
                <Button
                  variant="danger"
                  className="!bg-red-600 !text-white hover:!bg-red-700"
                  onClick={handleClearReal}
                  disabled={confirmText !== CONFIRM_PHRASE || clearing}
                >
                  Clear all real data
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
