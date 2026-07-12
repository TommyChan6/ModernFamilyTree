// Authentication primitives shared by every backend (Electron main, browser-
// local, and the future HTTP server). Everything here is platform-free: the
// Web Crypto API (globalThis.crypto) exists in both Node 18+ and browsers, so
// password hashing behaves identically on desktop, web, and — later — the
// server. When the hosted backend arrives, this module moves server-side
// unchanged; only the transport around it swaps.

import type { DB, Session, User } from './types'

// ── Password hashing (PBKDF2-HMAC-SHA256 via Web Crypto) ─────────────────────
// The iteration count is stored per user record, so it can be raised later and
// old accounts keep verifying (and can be transparently re-hashed on login).
const DEFAULT_PBKDF2_ITERATIONS = 600_000 // OWASP guidance for PBKDF2-SHA256

let pbkdf2Iterations = DEFAULT_PBKDF2_ITERATIONS

/** Test hook: dial the work factor down so suites stay fast. */
export function __setPbkdf2IterationsForTesting(n: number): void {
  pbkdf2Iterations = n
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function deriveHash(password: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(saltHex) as unknown as BufferSource,
      iterations
    },
    key,
    256
  )
  return bytesToHex(new Uint8Array(bits))
}

export interface PasswordRecord {
  password_hash: string
  password_salt: string
  password_iterations: number
}

/** Hash a new password with a fresh random salt. */
export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
  return {
    password_hash: await deriveHash(password, salt, pbkdf2Iterations),
    password_salt: salt,
    password_iterations: pbkdf2Iterations
  }
}

/** Constant-time hex comparison — no early exit on the first differing byte. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyPassword(password: string, rec: PasswordRecord): Promise<boolean> {
  const hash = await deriveHash(password, rec.password_salt, rec.password_iterations)
  return timingSafeEqualHex(hash, rec.password_hash)
}

// ── Session tokens ────────────────────────────────────────────────────────────
export const SESSION_DAYS = 30
const LOCKOUT_THRESHOLD = 5 // failed logins before the account locks…
const LOCKOUT_MINUTES = 5 // …and for how long

/** 256-bit random bearer token (the local stand-in for a session cookie). */
export function generateSessionToken(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
}

// nowStr() timestamps ('YYYY-MM-DD HH:MM:SS', UTC) compare lexicographically,
// so expiry checks are plain string comparisons. These helpers do the only
// date arithmetic auth needs.
function parseNowStr(s: string): Date {
  return new Date(s.replace(' ', 'T') + 'Z')
}

function toNowStr(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

export function addMinutes(now: string, minutes: number): string {
  return toNowStr(new Date(parseNowStr(now).getTime() + minutes * 60_000))
}

export function addDays(now: string, days: number): string {
  return addMinutes(now, days * 24 * 60)
}

/** Drop every expired session (called on login/register so the table can't grow forever). */
export function pruneSessions(db: DB, now: string): void {
  for (const [token, s] of Object.entries(db.sessions)) {
    if (s.expires_at <= now) delete db.sessions[token]
  }
}

/** Token → live User, or null (missing, expired, or user deleted). */
export function resolveSession(db: DB, token: string | null | undefined, now: string): User | null {
  if (!token) return null
  const session: Session | undefined = db.sessions[token]
  if (!session || session.expires_at <= now) return null
  return db.users[session.user_id] || null
}

export function isLockedOut(user: User, now: string): boolean {
  return !!user.locked_until && user.locked_until > now
}

export function recordFailedLogin(user: User, now: string): void {
  user.failed_logins = (user.failed_logins || 0) + 1
  if (user.failed_logins >= LOCKOUT_THRESHOLD) {
    user.locked_until = addMinutes(now, LOCKOUT_MINUTES)
    user.failed_logins = 0
  }
}

export function clearFailedLogins(user: User): void {
  user.failed_logins = 0
  user.locked_until = null
}

// ── Input validation (shared so client and "server" enforce identical rules) ─
export const USERNAME_MIN = 3
export const USERNAME_MAX = 20
export const PASSWORD_MIN = 8
const USERNAME_RE = /^[a-zA-Z0-9._-]+$/

/** Returns an error message, or null when the username is acceptable. */
export function validateUsername(username: unknown): string | null {
  if (typeof username !== 'string' || username.trim().length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters`
  }
  const name = username.trim()
  if (name.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters`
  if (!USERNAME_RE.test(name)) {
    return 'Username may only contain letters, numbers, dots, dashes and underscores'
  }
  return null
}

/** Returns an error message, or null when the password is acceptable. */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters`
  }
  if (password.length > 128) return 'Password must be at most 128 characters'
  return null
}

// ── Plan limits (the free tier; paid tiers slot in beside it later) ──────────
export interface PlanLimits {
  maxProjects: number
  maxPersons: number
  maxImages: number
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { maxProjects: 10, maxPersons: 2500, maxImages: 300 }
}

export function limitsFor(user: User): PlanLimits {
  return PLAN_LIMITS[user.plan] || PLAN_LIMITS.free
}

// ── Request envelope ──────────────────────────────────────────────────────────
// The renderer's api seam wraps every payload with the session token — the
// local equivalent of the browser attaching a session cookie to each request.
// Both shells unwrap it before dispatching to a channel handler; bare payloads
// (tests, legacy callers) pass through untouched with no token.
interface AuthedRequest {
  __authedRequest: true
  token: string | null
  data: unknown
}

export function wrapRequest(token: string | null, data: unknown): AuthedRequest {
  return { __authedRequest: true, token, data }
}

export function unwrapRequest(raw: unknown): { token: string | null; data: unknown } {
  if (raw && typeof raw === 'object' && (raw as AuthedRequest).__authedRequest === true) {
    const req = raw as AuthedRequest
    return { token: req.token ?? null, data: req.data }
  }
  return { token: null, data: raw }
}

/** Channels callable without a signed-in user; every other channel is rejected
 *  by the shells when the token is missing/expired — exactly the auth
 *  middleware a hosted server would run. globalSettings stay public because
 *  they are device-level (theme, program mode) and load before sign-in. */
export const PUBLIC_CHANNELS = new Set([
  'auth:register',
  'auth:login',
  'auth:guest',
  'auth:logout',
  'auth:session',
  'globalSettings:getAll',
  'globalSettings:set'
])
