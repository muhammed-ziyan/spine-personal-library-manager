/**
 * Library connections — Spine's replacement for accounts.
 *
 * A library is one Apps Script deployment bound to one Google Sheet. The
 * person using Spine deploys that script themselves and pastes its web-app URL
 * into the You screen; switching library is switching "account". Connections
 * live in localStorage on this device only. The optional access key is the
 * shared secret the sheet owner may set in Script Properties (ACCESS_KEY).
 */
import { isValidAppsScriptUrl } from './config'

export interface Connection {
  id: string
  /** Display name — defaults to the sheet's title as reported by the backend. */
  label: string
  /** Normalised Apps Script web-app URL (…/exec). */
  url: string
  /** Empty when the deployment has no ACCESS_KEY configured. */
  accessKey: string
  /** Sheet title as reported by `ping` when the connection was verified. */
  sheetName: string
  createdAt: number
}

export interface ConnectionTarget {
  url: string
  accessKey: string
}

interface StoredState {
  version: 1
  activeId: string | null
  connections: Connection[]
}

type Listener = (state: { connections: Connection[]; active: Connection | null }) => void

const STORAGE_KEY = 'spine.connections'
const LABEL_MAX = 60

let state: StoredState = read()
const listeners = new Set<Listener>()

function read(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, activeId: null, connections: [] }
    const parsed = JSON.parse(raw) as Partial<StoredState>
    const connections = Array.isArray(parsed.connections) ? parsed.connections.filter(isConnection) : []
    const activeId = connections.some((c) => c.id === parsed.activeId) ? (parsed.activeId as string) : connections[0]?.id ?? null
    return { version: 1, activeId, connections }
  } catch {
    return { version: 1, activeId: null, connections: [] }
  }
}

function isConnection(value: unknown): value is Connection {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  return typeof c.id === 'string' && typeof c.url === 'string' && typeof c.label === 'string'
}

function write(next: StoredState) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private mode or full storage: the connection lives in memory for this visit */
  }
  const snapshot = { connections: state.connections, active: connections.getActive() }
  listeners.forEach((listener) => listener(snapshot))
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Tidy a pasted deployment URL: trim, add https:// when the scheme was left
 * off, drop query/hash. Returns null when it is not somewhere Spine may call.
 */
export function normalizeAppsScriptUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withScheme)
    parsed.search = ''
    parsed.hash = ''
    const href = parsed.href.replace(/\/$/, '')
    return isValidAppsScriptUrl(href) ? href : null
  } catch {
    return null
  }
}

/** Short, human form of a URL for list rows: "script.google.com/…/AKfy…" */
export function describeConnectionUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'script.google.com') {
      const id = parsed.pathname.split('/').filter(Boolean).at(-2) ?? ''
      return `script.google.com · ${id.slice(0, 6)}…${id.slice(-4)}`
    }
    return parsed.host
  } catch {
    return url
  }
}

function cleanLabel(label: string, fallback: string): string {
  const trimmed = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX)
  return trimmed || fallback
}

export const connections = {
  list(): Connection[] {
    return state.connections
  },

  getActive(): Connection | null {
    return state.connections.find((c) => c.id === state.activeId) ?? null
  },

  /** What the API client needs for the current request, or null when nothing is connected. */
  getActiveTarget(): ConnectionTarget | null {
    const active = connections.getActive()
    return active ? { url: active.url, accessKey: active.accessKey } : null
  },

  findByUrl(url: string): Connection | null {
    return state.connections.find((c) => c.url === url) ?? null
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /**
   * Save a verified connection and make it active. Re-connecting an existing
   * URL updates that entry (new key / label) instead of duplicating it.
   */
  add(input: { url: string; accessKey: string; label: string; sheetName: string }): Connection {
    const existing = connections.findByUrl(input.url)
    const label = cleanLabel(input.label, input.sheetName || 'My library')
    if (existing) {
      const updated: Connection = { ...existing, label, accessKey: input.accessKey, sheetName: input.sheetName }
      write({ ...state, activeId: existing.id, connections: state.connections.map((c) => (c.id === existing.id ? updated : c)) })
      return updated
    }
    const created: Connection = { id: newId(), url: input.url, accessKey: input.accessKey, label, sheetName: input.sheetName, createdAt: Date.now() }
    write({ ...state, activeId: created.id, connections: [...state.connections, created] })
    return created
  },

  update(id: string, patch: Partial<Pick<Connection, 'label' | 'accessKey'>>): void {
    write({
      ...state,
      connections: state.connections.map((c) => {
        if (c.id !== id) return c
        return {
          ...c,
          label: patch.label === undefined ? c.label : cleanLabel(patch.label, c.sheetName || c.label),
          accessKey: patch.accessKey === undefined ? c.accessKey : patch.accessKey.trim(),
        }
      }),
    })
  },

  setActive(id: string): void {
    if (!state.connections.some((c) => c.id === id)) return
    write({ ...state, activeId: id })
  },

  /** Forget a connection on this device. The sheet itself is untouched. */
  remove(id: string): void {
    const remaining = state.connections.filter((c) => c.id !== id)
    const activeId = state.activeId === id ? remaining[0]?.id ?? null : state.activeId
    write({ version: 1, activeId, connections: remaining })
  },
}
