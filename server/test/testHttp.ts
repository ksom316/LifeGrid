import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Minimal stand-ins for VercelRequest/VercelResponse — just enough surface
 * for server/http.ts's helpers and every api/*.ts handler (method, query,
 * headers.cookie, body in; status/json/end/setHeader out). Tests call the
 * exported default handler functions directly with these, so the exact same
 * code that Vercel would invoke in production runs in the test — nothing
 * about routing or auth is reimplemented or mocked away.
 */
const DEFAULT_TEST_HOST = 'life-grid.example'

export function mockReq(opts: {
  method?: string
  query?: Record<string, string>
  body?: unknown
  cookie?: string
  /** Defaults to the same value as `host` (same-origin, the common case). Pass a different value, or `null`, to test assertSameOrigin's CSRF rejection paths. */
  origin?: string | null
  /** Defaults to DEFAULT_TEST_HOST. Pass `null` to simulate a request with no Host header at all. */
  host?: string | null
  /** Set to test assertJsonContentType's rejection path (e.g. 'text/plain', 'multipart/form-data'). Omitted by default, matching how most of this suite's requests are built (no header set at all, same as not enforcing it). */
  contentType?: string
  /** Set to test assertSameOrigin's Referer fallback (used when a real browser omits Origin on a same-origin request — see that function's comment). Not set by default alongside the default Origin. */
  referer?: string
}): VercelRequest {
  const host = opts.host === null ? undefined : (opts.host ?? DEFAULT_TEST_HOST)
  const origin = opts.origin === null ? undefined : (opts.origin ?? (host ? `https://${host}` : undefined))
  const headers: Record<string, string> = {}
  if (opts.cookie) headers.cookie = opts.cookie
  if (host) headers.host = host
  if (origin) headers.origin = origin
  if (opts.referer) headers.referer = opts.referer
  if (opts.contentType) headers['content-type'] = opts.contentType

  return {
    method: opts.method ?? 'GET',
    query: opts.query ?? {},
    body: opts.body,
    headers,
  } as unknown as VercelRequest
}

export interface MockResponse {
  res: VercelResponse
  statusCode: () => number
  body: () => unknown
  headers: () => Record<string, string>
}

export function mockRes(): MockResponse {
  let statusCode = 200
  let body: unknown
  const headers: Record<string, string> = {}

  const res = {
    status(code: number) {
      statusCode = code
      return res
    },
    json(payload: unknown) {
      body = payload
      return res
    },
    end(payload?: unknown) {
      if (payload !== undefined) body = payload
      return res
    },
    setHeader(name: string, value: string) {
      headers[name] = value
      return res
    },
  } as unknown as VercelResponse

  return {
    res,
    statusCode: () => statusCode,
    body: () => body,
    headers: () => headers,
  }
}

/** Extracts the session cookie's value from a Set-Cookie header string, for chaining a login into subsequent authenticated requests. */
export function extractCookieValue(setCookieHeader: string): string {
  const match = /^[^=]+=([^;]+)/.exec(setCookieHeader)
  return match ? `${setCookieHeader.split('=')[0]}=${match[1]}` : ''
}
