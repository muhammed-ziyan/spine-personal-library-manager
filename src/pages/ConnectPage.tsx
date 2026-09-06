import { Logo } from '@/components'
import { ConnectionForm } from '@/features/connections/ConnectionForm'
import { config } from '@/services/config'
import styles from './ConnectPage.module.css'

/**
 * First-run screen: no account, no sign-in. The reader deploys the Spine
 * script to their own Google Sheet once and pastes its web-app URL here.
 * Saving happens inside ConnectionForm; the Gate re-renders once a connection
 * becomes active.
 */
export function ConnectPage() {
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
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Connect your library</h2>
          <p className={styles.note}>Your books live in a Google Sheet you own. Paste the URL of the Spine script attached to it — no account needed.</p>
        </div>

        <ConnectionForm initial={{ url: config.defaultAppsScriptUrl }} onConnected={() => undefined} />

        <details className={styles.help}>
          <summary>Where do I get the URL?</summary>
          <ol>
            <li>Open your sheet → Extensions → Apps Script and paste in the Spine backend.</li>
            <li>Run <code>setupSpreadsheet</code> once to create the tabs.</li>
            <li>Deploy → New deployment → Web app, executing as you, for anyone. Copy the URL ending in <code>/exec</code>.</li>
          </ol>
          <p>The full walkthrough is in the project README. Anyone with the URL can use the library, so share it like a password.</p>
        </details>
      </div>
    </main>
  )
}
