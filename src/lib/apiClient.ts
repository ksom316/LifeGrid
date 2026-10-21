/**
 * Thin fetch wrapper for the hosted API (api/*.ts, deployed as Vercel
 * Functions at the same origin as the app). `credentials: 'include'` sends
 * the httpOnly session cookie on every request; there is no token to manage
 * client-side. Every call can fail for reasons a user should be told about
 * distinctly — not authenticated, server unreachable, or a validation
 * error — which is why this throws typed errors instead of just rejecting.
 */

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Thrown specifically for a 401, so callers (AuthContext) can distinguish "logged out" from any other failure. */
export class UnauthorizedError extends ApiError {
  constructor(message: string) {
    super(401, message)
  }
}

/** Thrown when the request never reached the server at all (offline, DNS failure, CORS, etc.) — distinct from a server-returned error. */
export class NetworkError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new NetworkError('Could not reach the server. Check your connection and try again.')
  }

  if (response.status === 204) return undefined as T

  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Request failed (${response.status}).`
    if (response.status === 401) throw new UnauthorizedError(message)
    throw new ApiError(response.status, message)
  }

  return body as T
}

/**
 * Local repos merge a patch via `{...existing, ...patch}`, so an explicit
 * `{ field: undefined }` already means "clear this field" there — that's
 * how e.g. TaskCard clears `completedAt` when reopening a task. Sent as
 * JSON, though, `undefined` values are dropped entirely, so the same patch
 * would silently mean "leave unchanged" to the API. Converting an
 * explicitly-present `undefined` to `null` before sending preserves the
 * caller's intent without requiring every call site (or the remote repos'
 * public signatures) to know about this JSON-specific wrinkle.
 */
export function patchForJson<T extends object>(patch: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) {
    const value = (patch as Record<string, unknown>)[key]
    out[key] = value === undefined ? null : value
  }
  return out
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) }),
}
