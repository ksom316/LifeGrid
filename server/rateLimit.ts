import type { VercelRequest } from '@vercel/node'
import type { Sql } from './db.ts'
import { HttpError } from './http.ts'

/**
 * A fixed-window rate limit backed by Postgres (db/migrations/0002_rate_limits.sql),
 * not function-instance memory — a serverless function instance is not
 * guaranteed to exist by the time the next request for the same key
 * arrives, so an in-memory counter would not actually bound anything in
 * production, only in a single long-running local process. The whole
 * check-and-increment happens as one atomic UPSERT (no separate read then
 * write), so concurrent requests racing the same key still count
 * correctly rather than both reading a stale count.
 */
export async function checkRateLimit(
  sql: Sql,
  key: string,
  { maxAttempts, windowSeconds }: { maxAttempts: number; windowSeconds: number },
): Promise<{ allowed: boolean }> {
  const { rows } = await sql.query<{ count: number }>(
    `insert into rate_limits (key, count, window_start)
     values ($1, 1, now())
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - $2::interval then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - $2::interval then now() else rate_limits.window_start end
     returning count`,
    [key, `${windowSeconds} seconds`],
  )
  const count = rows[0]?.count ?? 1
  return { allowed: count <= maxAttempts }
}

/** Throws 429 if the limit is exceeded; otherwise returns normally having recorded this attempt. */
export async function enforceRateLimit(
  sql: Sql,
  key: string,
  limits: { maxAttempts: number; windowSeconds: number },
): Promise<void> {
  const { allowed } = await checkRateLimit(sql, key, limits)
  if (!allowed) {
    throw new HttpError(429, 'Too many attempts. Please wait and try again.')
  }
}

/**
 * Best-effort client identifier for IP-scoped limits, from the
 * `x-forwarded-for` header Vercel's edge network sets reliably (the
 * leftmost entry is the original client). Only used to widen a rate limit
 * beyond a single email address (e.g. many signups from one source); the
 * primary, trustworthy limit is always keyed by the authenticated resource
 * itself (the email being signed up or logged into), which this
 * complements rather than replaces.
 */
export function clientIp(req: VercelRequest): string {
  const header = req.headers['x-forwarded-for']
  const value = Array.isArray(header) ? header[0] : header
  const first = value?.split(',')[0]?.trim()
  return first || 'unknown'
}
