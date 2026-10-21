import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { Sql } from './db.ts'

const scrypt = promisify(scryptCallback)

const SCRYPT_KEYLEN = 64
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
export const SESSION_COOKIE_NAME = 'lg_session'

export interface AuthUser {
  id: string
  email: string
}

/**
 * Hashes a password with scrypt (Node's built-in, no extra dependency) using
 * a random per-password salt, stored alongside the hash as "salt:hash" so a
 * single text column holds everything needed to verify it later.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':')
  if (!salt || !hashHex) return false
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer
  const expected = Buffer.from(hashHex, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

function hashToken(token: string): string {
  // Session tokens are hashed before storage (same reasoning as passwords):
  // a leaked database dump must not hand out usable session tokens. SHA-256
  // (not scrypt) is fine here — the token is already a 256-bit random
  // value, not a low-entropy user-chosen secret, so there's nothing for a
  // slow KDF to protect against.
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export interface CreateSessionResult {
  token: string
  expiresAt: Date
}

export async function createSession(sql: Sql, userId: string): Promise<CreateSessionResult> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await sql.query('insert into sessions (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)', [
    randomUUID(),
    userId,
    hashToken(token),
    expiresAt.toISOString(),
  ])
  return { token, expiresAt }
}

export async function deleteSession(sql: Sql, token: string): Promise<void> {
  await sql.query('delete from sessions where token_hash = $1', [hashToken(token)])
}

/** Verifies a session token and returns the owning user, or null if missing/expired/invalid. */
export async function resolveSession(sql: Sql, token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null
  const { rows } = await sql.query<{ id: string; email: string; expires_at: string }>(
    `select u.id, u.email, s.expires_at
     from sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1`,
    [hashToken(token)],
  )
  const row = rows[0]
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    // Lazily sweep expired sessions as they're encountered, rather than
    // needing a separate scheduled job — this is the only place an expired
    // row is ever looked up, so this keeps the table from growing forever
    // without adding cron infrastructure for what's explicitly out of
    // scope this milestone.
    await sql.query('delete from sessions where token_hash = $1', [hashToken(token)])
    return null
  }
  return { id: row.id, email: row.email }
}

/**
 * Whether to mark the session cookie `Secure` (HTTPS-only). `NODE_ENV`
 * alone isn't reliable for this on Vercel: it's set by framework-specific
 * build tooling, not guaranteed for a plain serverless function at runtime.
 * `VERCEL_ENV` is what Vercel itself always sets — 'production' or
 * 'preview' (both served over HTTPS) or 'development' (set by `vercel dev`,
 * typically plain HTTP) — so it's checked first, falling back to NODE_ENV
 * only when running entirely outside Vercel (e.g. a different host).
 */
function shouldSecureCookie(): boolean {
  const vercelEnv = process.env.VERCEL_ENV
  if (vercelEnv) return vercelEnv !== 'development'
  return process.env.NODE_ENV === 'production'
}

export function sessionCookie(token: string, expiresAt: Date): string {
  const secure = shouldSecureCookie() ? '; Secure' : ''
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=${expiresAt.toUTCString()}`
}

export function clearedSessionCookie(): string {
  const secure = shouldSecureCookie() ? '; Secure' : ''
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`
}

export function parseCookies(header: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}
