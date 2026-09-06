/**
 * The signed-in session — Spine's replacement for accounts.
 *
 * Signing in exchanges a username and password for a token that the backend
 * signed and can verify on its own (see apps-script/Auth.gs). Only that token
 * is kept here; the password is never stored, and never leaves the sign-in
 * form. The token lives in localStorage so a phone that installed the PWA is
 * not asked again every launch, and expires after 30 days.
 *
 * This module holds no network code: services/api.ts reads the token from here
 * and clears it when the backend rejects it.
 */

export interface Session {
  token: string
  /** Epoch milliseconds. Past this, the backend refuses the token anyway. */
  expiresAt: number
  username: string
  /** Sheet title as reported at sign-in; the name shown around the app. */
  library: string
}

type Listener = (session: Session | null) => void

const STORAGE_KEY = 'spine.session'

let current: Session | null = read()
const listeners = new Set<Listener>()

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return typeof s.token === 'string' && s.token.length > 0 && typeof s.expiresAt === 'number' && typeof s.username === 'string'
}

function read(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isSession(parsed)) return null
    // Drop an expired token here rather than letting the first request fail.
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return { ...parsed, library: typeof parsed.library === 'string' ? parsed.library : 'My library' }
  } catch {
    return null
  }
}

function write(next: Session | null) {
  current = next
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode or full storage: the session lives in memory for this visit */
  }
  listeners.forEach((listener) => listener(current))
}

export const session = {
  get(): Session | null {
    return current
  },

  /** The token to send with a request, or null when signed out. */
  getToken(): string | null {
    return current?.token ?? null
  },

  start(next: Session): Session {
    write(next)
    return next
  },

  /** Update the library summary after a sync, leaving the token alone. */
  rename(library: string): void {
    if (current && library && library !== current.library) write({ ...current, library })
  },

  /** Sign out on this device. The sheet and the deployment are untouched. */
  end(): void {
    if (current) write(null)
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
