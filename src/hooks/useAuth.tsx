import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth, type AuthSession } from '@/services/auth'
import { isConfigured, isLocalDevMode } from '@/services/config'

export type AuthStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in'

interface AuthContextValue {
  status: AuthStatus
  session: AuthSession | null
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => auth.getSession())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.subscribe(setSession)
    if (!isConfigured() || isLocalDevMode()) {
      setReady(true)
      return unsubscribe
    }
    // Initialise GIS up-front so One Tap can silently restore a session; this
    // does not request any device permission.
    auth
      .init()
      .then(() => {
        if (!auth.getSession()) auth.promptSilently()
      })
      .catch(() => {
        /* GIS failed to load; the sign-in screen will show a retry */
      })
      .finally(() => setReady(true))
    return unsubscribe
  }, [])

  // Re-check expiry once a minute so a stale token surfaces the sign-in screen.
  useEffect(() => {
    const timer = window.setInterval(() => setSession(auth.getSession()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus
    if (!isConfigured()) status = 'unconfigured'
    else if (!ready) status = 'loading'
    else status = session ? 'signed-in' : 'signed-out'
    return { status, session, signOut: auth.signOut }
  }, [ready, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
