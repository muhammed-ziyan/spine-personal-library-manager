import { useEffect, useRef, useState } from 'react'
import { Button, Logo } from '@/components'
import { auth } from '@/services/auth'
import { isLocalDevMode } from '@/services/config'
import styles from './SignInPage.module.css'

export function SignInPage() {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // `import.meta.env.DEV` is a compile-time constant, so the dev branch below is
  // removed from production bundles entirely.
  const devMode = import.meta.env.DEV && isLocalDevMode()

  useEffect(() => {
    const container = buttonRef.current
    if (!container || devMode) return
    let cancelled = false
    setError(null)
    auth.renderButton(container).catch(() => {
      if (!cancelled) setError("Google sign-in couldn't load. Check your connection and try again.")
    })
    return () => {
      cancelled = true
    }
  }, [attempt, devMode])

  return (
    <main className={styles.screen}>
      <span className={styles.blobTop} aria-hidden="true" />
      <span className={styles.blobBottom} aria-hidden="true" />

      <div className={styles.hero}>
        <Logo size="lg" />
        <div>
          <h1 className={styles.wordmark}>Spine</h1>
          <p className={styles.tagline}>Every book you own, in your pocket.</p>
        </div>
      </div>

      <div className={styles.card}>
        {devMode ? (
          // Development builds only: this branch is dead code in production
          // bundles and the deployed backend rejects unsigned tokens anyway.
          <Button size="lg" block onClick={() => auth.startLocalDevSession()}>
            Use local development session
          </Button>
        ) : (
          <div ref={buttonRef} className={styles.googleButton} />
        )}

        {error && (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            <Button variant="secondary" size="sm" icon="refresh" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        )}

        <p className={styles.note}>
          {devMode ? 'Connected to the local development backend. Data is kept in memory only.' : 'Sign in with the Google account that owns your library spreadsheet. Spine never sees your password.'}
        </p>
      </div>
    </main>
  )
}
