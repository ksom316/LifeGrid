import { toDateKey } from './date'

/** Triggers a browser-generated file download — nothing is sent anywhere. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function backupFilename(date: Date = new Date()): string {
  return `life-grid-backup-${toDateKey(date)}.json`
}
