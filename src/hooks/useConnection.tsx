/**
 * The active library connection and the list of saved ones. Spine has no
 * sign-in: "who you are" is which Google Sheet you're connected to, and
 * switching connection is switching account.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, probeConnection } from '@/services/api'
import { connections, normalizeAppsScriptUrl, type Connection } from '@/services/connections'

export interface ConnectInput {
  url: string
  accessKey: string
  /** Optional display name; falls back to the sheet's title. */
  label: string
}

interface ConnectionContextValue {
  connections: Connection[]
  active: Connection | null
  /** Verify the URL/key against the backend, then save it and make it active. Throws ApiError. */
  connect: (input: ConnectInput) => Promise<Connection>
  switchTo: (id: string) => void
  update: (id: string, patch: Partial<Pick<Connection, 'label' | 'accessKey'>>) => void
  /** Forget a connection on this device; the sheet is untouched. */
  remove: (id: string) => void
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null)

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Connection[]>(() => connections.list())
  const [active, setActive] = useState<Connection | null>(() => connections.getActive())

  useEffect(
    () =>
      connections.subscribe((next) => {
        setList(next.connections)
        setActive(next.active)
      }),
    [],
  )

  const connect = useCallback(async ({ url, accessKey, label }: ConnectInput) => {
    const normalized = normalizeAppsScriptUrl(url)
    if (!normalized) {
      throw new ApiError('VALIDATION', 'Paste the web-app URL from your Apps Script deployment — it ends in /exec.')
    }
    const key = accessKey.trim()
    const ping = await probeConnection({ url: normalized, accessKey: key })
    return connections.add({ url: normalized, accessKey: key, label, sheetName: ping.library })
  }, [])

  const value = useMemo<ConnectionContextValue>(
    () => ({ connections: list, active, connect, switchTo: connections.setActive, update: connections.update, remove: connections.remove }),
    [list, active, connect],
  )

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext)
  if (!ctx) throw new Error('useConnection must be used inside ConnectionProvider')
  return ctx
}
