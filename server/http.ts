import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthUser } from './auth.ts'
import { parseCookies, resolveSession, SESSION_COOKIE_NAME } from './auth.ts'
import { getPool } from './db.ts'
import type { SqlPool } from './db.ts'

/** A handler failure with a specific HTTP status, as opposed to an unexpected server error. */
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message)
}

export function notFound(message = 'Not found'): never {
  throw new HttpError(404, message)
}

/** Postgres SQLSTATE for unique_violation — the same code on real Postgres/Neon and pg-mem. */
const PG_UNIQUE_VIOLATION = '23505'

export function sendError(res: VercelResponse, err: unknown): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  if (isPgErrorWithCode(err, PG_UNIQUE_VIOLATION)) {
    // A client-supplied id (e.g. from the local-data-migration flow)
    // collided with an existing row. Translated to a clean, generic 409 —
    // never echo the driver's raw message, which includes the offending
    // constraint name and value and could confirm whether a *specific*
    // guessed id already exists in the system (an enumeration side
    // channel), on top of being an internal implementation detail.
    res.status(409).json({ error: 'A record with this id already exists.' })
    return
  }
  // Never leak internals (stack traces, driver error text that might
  // include query fragments) to the client — log server-side, return a
  // generic message, per "secure API error handling."
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}

function isPgErrorWithCode(err: unknown, code: string): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === code
}

/** Reads a JSON request body regardless of whether the runtime already parsed it. */
export function readJsonBody(req: VercelRequest): unknown {
  const body = req.body
  if (body === undefined || body === null || body === '') return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      badRequest('Request body is not valid JSON.')
    }
  }
  return body
}

/** Rejects any method not in `allowed`, replying 405 with an Allow header, as Vercel Functions don't do this automatically. */
export function requireMethod(req: VercelRequest, res: VercelResponse, allowed: string[]): boolean {
  if (!req.method || !allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '))
    res.status(405).json({ error: `Method ${req.method ?? ''} not allowed` })
    return false
  }
  return true
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defense for cookie-authenticated requests. `SameSite=Lax` on the
 * session cookie already blocks cross-site non-GET requests in modern
 * browsers, but that alone isn't a complete defense (older browsers,
 * misconfigured proxies, or a future cookie-flag change) — so every
 * state-changing request additionally has to prove it actually originated
 * from this app's own origin. This is a single-origin app (the frontend and
 * `/api` are served from the same Vercel deployment), so "the request's
 * origin matches our own Host" is a complete, simple check — no origin
 * allowlist needed, and no distinct CORS configuration either, since that
 * would only apply to cross-origin fetches, which this check already blocks
 * before they reach a handler. Safe methods (GET/HEAD/OPTIONS) never
 * mutate, so they're exempt.
 *
 * `Origin` is preferred, but is NOT reliably present on a same-origin
 * request — confirmed empirically with a real browser against this app's
 * own signup form: a same-origin `fetch()` POST sent `Referer` but no
 * `Origin` header at all. (Cross-origin requests, which is what this check
 * actually needs to catch, DO always carry `Origin`.) So `Referer` is
 * accepted as a fallback when `Origin` is absent — the same approach
 * Django's and Rails' built-in CSRF protections use for this exact reason.
 */
export function assertSameOrigin(req: VercelRequest): void {
  const method = (req.method ?? 'GET').toUpperCase()
  if (SAFE_METHODS.has(method)) return

  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host
  if (!host) {
    // Can't verify same-origin without knowing our own host — fail closed
    // rather than silently skipping the check.
    throw new HttpError(403, 'Request origin could not be verified.')
  }

  const sourceUrl = req.headers.origin ?? req.headers.referer
  if (!sourceUrl) {
    // A real browser always sends at least one of these on a same-origin
    // fetch/XHR/form POST — their joint absence is not something legitimate
    // app traffic produces.
    throw new HttpError(403, 'Missing Origin/Referer header.')
  }

  let sourceHost: string
  try {
    sourceHost = new URL(sourceUrl).host
  } catch {
    throw new HttpError(403, 'Invalid Origin/Referer header.')
  }

  if (sourceHost !== host) {
    throw new HttpError(403, 'Cross-origin request blocked.')
  }
}

/**
 * Rejects a state-changing request whose Content-Type isn't JSON. Besides
 * basic input hygiene, this is a second CSRF layer: a classic HTML
 * `<form>` CSRF submission cannot set `Content-Type: application/json`
 * without becoming a CORS "non-simple" request, which a cross-site form
 * submission can't do at all (forms can't trigger a preflight). A request
 * with no body at all (common for action endpoints like logout or
 * complete) is allowed through regardless of this header.
 */
function assertJsonContentType(req: VercelRequest): void {
  const method = (req.method ?? 'GET').toUpperCase()
  if (SAFE_METHODS.has(method)) return
  const contentType = req.headers['content-type']
  if (!contentType) return
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json.')
  }
}

/** Baseline security headers applied to every response, regardless of outcome. */
function applySecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
}

export interface AuthedContext {
  sql: SqlPool
  user: AuthUser
}

export type AuthedHandler = (req: VercelRequest, res: VercelResponse, ctx: AuthedContext) => Promise<void>

/**
 * Wraps a route handler so every protected endpoint goes through the exact
 * same authentication check — a single chokepoint rather than each of the
 * ~20 data endpoints re-implementing "is there a valid session" slightly
 * differently. `ctx.user.id` is the only source of truth repositories use
 * for ownership scoping; nothing in a request body or URL can override it.
 */
export function withAuth(handler: AuthedHandler) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    applySecurityHeaders(res)
    try {
      assertSameOrigin(req)
      assertJsonContentType(req)
      const sql = getPool()
      const cookies = parseCookies(req.headers.cookie)
      const user = await resolveSession(sql, cookies[SESSION_COOKIE_NAME])
      if (!user) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }
      await handler(req, res, { sql, user })
    } catch (err) {
      sendError(res, err)
    }
  }
}

/** Same chokepoint for unauthenticated endpoints (signup/login/health), still centralizing error handling and the CSRF origin check. */
export function withErrorHandling(handler: (req: VercelRequest, res: VercelResponse) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    applySecurityHeaders(res)
    try {
      assertSameOrigin(req)
      assertJsonContentType(req)
      await handler(req, res)
    } catch (err) {
      sendError(res, err)
    }
  }
}
