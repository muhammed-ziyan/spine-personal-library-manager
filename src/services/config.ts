/**
 * Build-time configuration. Spine has no sign-in: the person using it connects
 * their own Apps Script deployment from the app (see services/connections.ts).
 * The single value here is a convenience for development — it pre-fills the
 * Connect screen so a fresh `npm run dev` doesn't need a paste.
 */
export interface AppConfig {
  /** Optional Apps Script URL to suggest on the Connect screen. Never a secret. */
  defaultAppsScriptUrl: string
}

function readEnv(key: string): string {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value.trim() : ''
}

export const config: AppConfig = {
  defaultAppsScriptUrl: readEnv('VITE_APPS_SCRIPT_URL'),
}

/**
 * Only ever talk to a Google Apps Script endpoint — or, in development builds
 * only, the local dev backend (scripts/dev-backend.ts), which may be reached
 * via localhost or a LAN address when testing on a phone (`vite --host`).
 */
export function isValidAppsScriptUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' && parsed.hostname === 'script.google.com') return true
    if (import.meta.env.DEV && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) return true
    return false
  } catch {
    return false
  }
}
