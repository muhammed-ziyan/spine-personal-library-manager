/**
 * Google Identity Services wrapper.
 *
 * Spine never handles passwords. The user signs in with Google in the browser,
 * which yields a short-lived ID token (a signed JWT). That token is attached to
 * every Apps Script request and verified server-side (apps-script/Security.gs)
 * against the configured OAuth client ID and the allow-listed account.
 */
import { config, isLocalDevMode, LOCAL_DEV_CLIENT_ID } from './config'

const GSI_SRC = 'https://accounts.google.com/gsi/client'
const STORAGE_KEY = 'spine.idToken'

export interface AuthUser {
  email: string
  name: string
  picture: string
}

export interface AuthSession {
  idToken: string
  /** Seconds since epoch. */
  expiresAt: number
  user: AuthUser
}

type CredentialResponse = { credential?: string }

interface GoogleAccountsId {
  initialize(options: {
    client_id: string
    callback: (response: CredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    use_fedcm_for_prompt?: boolean
    itp_support?: boolean
  }): void
  prompt(): void
  renderButton(
    parent: HTMLElement,
    options: { theme?: string; size?: string; shape?: string; text?: string; width?: number; logo_alignment?: string },
  ): void
  disableAutoSelect(): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

type Listener = (session: AuthSession | null) => void

let scriptPromise: Promise<void> | null = null
let initialized = false
let session: AuthSession | null = restoreSession()
const listeners = new Set<Listener>()

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load Google sign-in.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/** Decode the JWT payload without verifying it — the backend does the verification. */
function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function sessionFromToken(idToken: string): AuthSession | null {
  const payload = decodePayload(idToken)
  if (!payload) return null
  const exp = typeof payload.exp === 'number' ? payload.exp : 0
  if (!exp || exp * 1000 <= Date.now()) return null
  return {
    idToken,
    expiresAt: exp,
    user: {
      email: typeof payload.email === 'string' ? payload.email : '',
      name: typeof payload.name === 'string' ? payload.name : '',
      picture: typeof payload.picture === 'string' ? payload.picture : '',
    },
  }
}

function restoreSession(): AuthSession | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    return stored ? sessionFromToken(stored) : null
  } catch {
    return null
  }
}

function setSession(next: AuthSession | null) {
  session = next
  try {
    if (next) sessionStorage.setItem(STORAGE_KEY, next.idToken)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable (private mode) — session stays in memory only */
  }
  listeners.forEach((listener) => listener(session))
}

function handleCredential(response: CredentialResponse) {
  if (!response.credential) return
  const next = sessionFromToken(response.credential)
  if (next) setSession(next)
}

export const auth = {
  getSession(): AuthSession | null {
    if (session && session.expiresAt * 1000 <= Date.now()) setSession(null)
    return session
  },

  /** Current ID token, or null when signed out / expired. */
  getToken(): string | null {
    return auth.getSession()?.idToken ?? null
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** Load GIS and initialise it. Safe to call repeatedly. */
  async init(): Promise<void> {
    if (!config.googleClientId) throw new Error('Google client ID is not configured.')
    await loadScript()
    const api = window.google?.accounts?.id
    if (!api) throw new Error('Google sign-in is unavailable.')
    if (initialized) return
    api.initialize({
      client_id: config.googleClientId,
      callback: handleCredential,
      auto_select: true,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      itp_support: true,
    })
    initialized = true
  },

  /** Render Google's own sign-in button into a container. */
  async renderButton(container: HTMLElement): Promise<void> {
    await auth.init()
    container.replaceChildren()
    window.google?.accounts?.id?.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      width: Math.min(320, Math.max(200, Math.floor(container.clientWidth))),
    })
  },

  /** Try a silent / One Tap refresh (used when a token expires mid-session). */
  async promptSilently(): Promise<void> {
    try {
      await auth.init()
      window.google?.accounts?.id?.prompt()
    } catch {
      /* ignore — the user can sign in again from the button */
    }
  },

  signOut() {
    window.google?.accounts?.id?.disableAutoSelect()
    setSession(null)
  },

  /** Called by the API client when the backend rejects a token. */
  invalidate() {
    setSession(null)
  },

  /**
   * Development builds only: mint an unsigned token for the local dev backend
   * (scripts/dev-backend.ts). Dead code in production bundles; the real
   * backend rejects unsigned tokens because Google cannot verify them.
   */
  startLocalDevSession: import.meta.env.DEV
    ? (email = 'you@example.com') => {
        if (!isLocalDevMode()) return
        const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        const payload = {
          aud: LOCAL_DEV_CLIENT_ID,
          iss: 'https://accounts.google.com',
          email,
          email_verified: 'true',
          name: 'Local Developer',
          picture: '',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }
        const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.dev`
        const next = sessionFromToken(token)
        if (next) setSession(next)
      }
    : () => {},
}
