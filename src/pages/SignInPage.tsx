import { Icon, Logo } from '@/components'
import { SignInForm } from '@/features/auth/SignInForm'
import { useSession } from '@/hooks/useSession'
import styles from './SignInPage.module.css'

/**
 * The door. One library, one sign-in — the deployment URL is baked into this
 * build, and the username and password are checked by the Apps Script that owns
 * the sheet. The Gate re-renders the app the moment a session exists.
 */
export function SignInPage() {
  const { backendUrl } = useSession()

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
        {backendUrl ? (
          <>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Welcome back</h2>
              <p className={styles.note}>Sign in to open your library.</p>
            </div>

            <SignInForm />

            <p className={styles.privacy}>
              <Icon name="lock" size={14} className={styles.privacyIcon} />
              Your password is checked by your own Google Apps Script and is never stored on this device.
            </p>
          </>
        ) : (
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Not connected yet</h2>
            <p className={styles.note}>
              This build has no library address. Set <code>VITE_APPS_SCRIPT_URL</code> to your Apps Script web-app URL — the one ending in <code>/exec</code> — and deploy again.
            </p>
            <p className={styles.note}>On Vercel that is Project → Settings → Environment Variables, then redeploy so the value is baked into the build.</p>
          </div>
        )}
      </div>
    </main>
  )
}
