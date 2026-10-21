import { useState } from 'react'
import { useAppData } from '../../state/AppDataContext'
import { Button } from '../ui/Button'

export function DemoDataBanner() {
  const { hasDemoData, removeSampleData } = useAppData()
  const [removing, setRemoving] = useState(false)

  if (!hasDemoData) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/20 bg-brand/10 px-4 py-3 text-xs text-brand-ink">
      <span>You're viewing sample data so you can see how Life Grid works.</span>
      <Button
        variant="secondary"
        size="sm"
        disabled={removing}
        onClick={async () => {
          setRemoving(true)
          try {
            await removeSampleData()
          } finally {
            setRemoving(false)
          }
        }}
      >
        Remove sample data
      </Button>
    </div>
  )
}
