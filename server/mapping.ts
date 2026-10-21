/**
 * Postgres drivers disagree on whether `date`/`timestamptz` columns come
 * back as a JS `Date` or an ISO string (confirmed empirically: `pg-mem`
 * returns `timestamptz` as a string but `date` as a `Date`; node-postgres's
 * default type parsers, which `@neondatabase/serverless` mirrors, return
 * both as `Date`). Every repository runs row values through these instead
 * of assuming either shape, so the API's JSON responses are string-typed
 * exactly like the existing client domain types in src/types/domain.ts
 * regardless of which driver produced the row.
 */

export function toDateTimeString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function toDateTimeStringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  return toDateTimeString(value)
}

/** For `date` columns: always "YYYY-MM-DD", never a full timestamp. */
export function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const s = String(value)
  return s.length > 10 ? s.slice(0, 10) : s
}

export function toDateStringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  return toDateString(value)
}

export function orUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value
}
