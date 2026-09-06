import { useRef, useState, type FormEvent } from 'react'
import { Button, Icon, InputField } from '@/components'
import { useSession } from '@/hooks/useSession'
import { describeError } from '@/services/api'
import styles from './SignInForm.module.css'

interface SignInFormProps {
  /** Inputs sitting on a surface card use the quiet tone. */
  tone?: 'default' | 'quiet'
  onSignedIn?: () => void
}

/**
 * Username and password, checked by the Apps Script deployment.
 *
 * Nothing is verified in the browser: the password goes straight to the backend,
 * which compares it against its Script Properties and answers with a signed
 * token. That is why no credential appears anywhere in this bundle.
 */
export function SignInForm({ tone = 'default', onSignedIn }: SignInFormProps) {
  const { signIn } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signIn({ username, password })
      // Never leave the password sitting in a React tree behind the app.
      setPassword('')
      onSignedIn?.()
    } catch (err) {
      setError(describeError(err))
      setPassword('')
      passwordRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const toggleReveal = () => {
    setReveal((shown) => !shown)
    passwordRef.current?.focus()
  }

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
      <InputField
        label="Username"
        tone={tone}
        type="email"
        inputMode="email"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="username"
        placeholder="you@example.com"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoFocus
      />

      <div className={styles.password}>
        <InputField
          ref={passwordRef}
          label="Password"
          tone={tone}
          type={reveal ? 'text' : 'password'}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="current-password"
          className={styles.passwordInput}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="button" className={styles.reveal} onClick={toggleReveal} aria-pressed={reveal} aria-label={reveal ? 'Hide password' : 'Show password'}>
          <Icon name={reveal ? 'eye-off' : 'eye'} size={18} />
        </button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" block loading={busy} disabled={busy || !username.trim() || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
