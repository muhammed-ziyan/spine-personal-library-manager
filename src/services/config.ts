/**
 * Runtime configuration. Both values are public identifiers shipped to the
 * browser; neither is a secret. Real secrets never belong in the frontend.
 */
export interface AppConfig {
  appsScriptUrl: string
  googleClientId: string
}

function readEnv(key: string): string {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value.trim() : ''
}

export const config: AppConfig = {
  appsScriptUrl: readEnv('VITE_APPS_SCRIPT_URL'),
  googleClientId: readEnv('VITE_GOOGLE_CLIENT_ID'),
}

/** Marker client ID that enables the local development session (dev builds only). */
export const LOCAL_DEV_CLIENT_ID = 'local-dev'

export function isConfigured(): boolean {
  return Boolean(config.appsScriptUrl && config.googleClientId)
}

export function isLocalDevMode(): boolean {
  return Boolean(import.meta.env.DEV) && config.googleClientId === LOCAL_DEV_CLIENT_ID
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
