/**
 * Who is signed in. Spine has one library, fixed at build time; signing in
 * proves you are allowed to open it.
 *
 * The provider mirrors services/session.ts into React state, so a token the API
 * client discards (expired, or the password changed on the sheet) drops the app
 * straight back to the sign-in screen wherever it happens.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/services/api'
import { resolveBackendUrl } from '@/services/config'
import { session, type Session } from '@/services/session'

export interface SignInInput {
  username: string
  password: string
}

interface SessionContextValue {
  session: Session | null
  /** True once a token is held; the app content is only mounted then. */
  signedIn: boolean
  /** Null when this build has no VITE_APPS_SCRIPT_URL — nothing can work. */
  backendUrl: string | null
  /** Exchange credentials for a session. Throws ApiError; the caller shows the message. */
  signIn: (input: SignInInput) => Promise<Session>
  signOut: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Session | null>(() => session.get())

  useEffect(() => session.subscribe(setCurrent), [])

  const signIn = useCallback(async ({ username, password }: SignInInput) => {
    const result = await api.login({ username: username.trim(), password })
    return session.start({
      token: result.token,
      expiresAt: result.expiresAt,
      username: result.username,
      library: result.library,
    })
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      session: current,
      signedIn: current !== null,
      backendUrl: resolveBackendUrl(),
      signIn,
      signOut: session.end,
    }),
    [current, signIn],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
