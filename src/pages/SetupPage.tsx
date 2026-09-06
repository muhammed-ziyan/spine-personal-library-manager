import { Logo } from '@/components'
import { config } from '@/services/config'
import styles from './SetupPage.module.css'

/** Shown when the build has no backend configured. Never shows secrets. */
export function SetupPage() {
  const missing = [!config.appsScriptUrl && 'VITE_APPS_SCRIPT_URL', !config.googleClientId && 'VITE_GOOGLE_CLIENT_ID'].filter(Boolean) as string[]

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <Logo />
        <h1 className={styles.title}>Almost there</h1>
        <p className={styles.text}>
          Spine isn't connected to a library yet. Add the following to a <code>.env</code> file and restart the app:
        </p>
        <ul className={styles.list}>
          {missing.map((key) => (
            <li key={key}>
              <code>{key}=</code>
            </li>
          ))}
        </ul>
        <p className={styles.hint}>
          See <strong>README.md → Google Apps Script setup</strong> for how to deploy the backend and obtain these values.
        </p>
      </div>
    </main>
  )
}
