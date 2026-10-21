import { badRequest } from './http.ts'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

export function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    badRequest(`${context} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

export function requireString(value: unknown, field: string, { maxLength = 10_000 } = {}): string {
  if (typeof value !== 'string' || value.trim().length === 0) badRequest(`"${field}" is required.`)
  if (value.length > maxLength) badRequest(`"${field}" is too long.`)
  return value.trim()
}

export function optionalString(value: unknown, field: string, { maxLength = 10_000 } = {}): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') badRequest(`"${field}" must be a string.`)
  if (value.length > maxLength) badRequest(`"${field}" is too long.`)
  return value
}

export function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    badRequest(`"${field}" must be one of: ${allowed.join(', ')}.`)
  }
  return value as T
}

export function optionalEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (value === undefined || value === null) return undefined
  return requireEnum(value, field, allowed)
}

export function optionalDate(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || !DATE_RE.test(value)) badRequest(`"${field}" must be a "YYYY-MM-DD" date.`)
  return value
}

export function optionalDateTime(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || !ISO_DATETIME_RE.test(value)) {
    badRequest(`"${field}" must be an ISO datetime string.`)
  }
  return value
}

export function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') badRequest(`"${field}" must be a boolean.`)
  return value
}

export function optionalUuid(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    badRequest(`"${field}" must be a UUID.`)
  }
  return value
}

export function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    badRequest(`"${field}" must be an array of strings.`)
  }
  return value as string[]
}

const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const

export interface TaskRecurrenceInput {
  frequency: 'daily' | 'weekly' | 'monthly'
  weekdays?: number[]
  dayOfMonth?: number
  endDate?: string
}

/** Mirrors the client's isRecurrenceConfigValid() + the shape checks in src/data/backup.ts's validateRecurrenceShape(). */
export function optionalRecurrence(value: unknown, field: string): TaskRecurrenceInput | undefined {
  if (value === undefined || value === null) return undefined
  const r = asRecord(value, field)
  const frequency = requireEnum(r.frequency, `${field}.frequency`, RECURRENCE_FREQUENCIES)

  let weekdays: number[] | undefined
  if (r.weekdays !== undefined) {
    if (!Array.isArray(r.weekdays) || r.weekdays.some((d) => typeof d !== 'number' || d < 0 || d > 6)) {
      badRequest(`"${field}.weekdays" must be an array of integers 0-6.`)
    }
    weekdays = r.weekdays as number[]
  }

  let dayOfMonth: number | undefined
  if (r.dayOfMonth !== undefined) {
    if (typeof r.dayOfMonth !== 'number' || r.dayOfMonth < 1 || r.dayOfMonth > 31) {
      badRequest(`"${field}.dayOfMonth" must be an integer 1-31.`)
    }
    dayOfMonth = r.dayOfMonth
  }
  if (frequency === 'monthly' && dayOfMonth === undefined) {
    badRequest(`"${field}.dayOfMonth" is required for monthly recurrence.`)
  }

  const endDate = optionalDate(r.endDate, `${field}.endDate`)

  return { frequency, weekdays, dayOfMonth, endDate }
}
