/**
 * Build-time configuration.
 *
 * Spine talks to exactly one Apps Script deployment, set at build time via
 * VITE_APPS_SCRIPT_URL (an environment variable on Vercel, `.env` locally).
 * That URL is not a secret — it ships inside the bundle, as any front-end
 * configuration must. It grants nothing on its own: the backend refuses every
 * action but `login` without a signed session token.
 */

function readEnv(key: string): string {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value.trim() : ''
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

/**
 * Where requests go, or null when this build was deployed without
 * VITE_APPS_SCRIPT_URL — or with an address we refuse to call. The sign-in
 * screen says so plainly rather than letting the first request fail.
 */
export function resolveBackendUrl(): string | null {
  const configured = readEnv('VITE_APPS_SCRIPT_URL')
  if (!configured) return null
  const origin = typeof location === 'undefined' ? undefined : location.origin
  let absolute: string
  try {
    // A relative "/api" is the dev proxy; resolve it against this origin.
    absolute = new URL(configured, origin).href
  } catch {
    return null
  }
  if (!isValidAppsScriptUrl(absolute)) return null
  return absolute.replace(/\/$/, '')
}
