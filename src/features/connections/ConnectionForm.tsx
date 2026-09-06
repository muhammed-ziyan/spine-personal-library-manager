import { useState, type FormEvent } from 'react'
import { Button, InputField } from '@/components'
import { useConnection } from '@/hooks/useConnection'
import { describeError } from '@/services/api'
import type { Connection } from '@/services/connections'
import styles from './ConnectionForm.module.css'

interface ConnectionFormProps {
  /** Pre-filled values (the dev default URL, or an existing connection being re-verified). */
  initial?: Partial<{ label: string; url: string; accessKey: string }>
  submitLabel?: string
  /** Inputs sitting on a surface card use the quiet tone. */
  tone?: 'default' | 'quiet'
  onConnected: (connection: Connection) => void
}

/**
 * Paste-a-URL form shared by the Connect screen and the You → Libraries sheet.
 * Verifies the deployment with `ping` before anything is saved, so a typo
 * never becomes a half-connected library.
 */
export function ConnectionForm({ initial, submitLabel = 'Connect library', tone = 'default', onConnected }: ConnectionFormProps) {
  const { connect } = useConnection()
  const [url, setUrl] = useState(initial?.url ?? '')
  const [accessKey, setAccessKey] = useState(initial?.accessKey ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      onConnected(await connect({ url, accessKey, label }))
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
      <InputField
        label="Apps Script web-app URL"
        tone={tone}
        type="url"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        placeholder="https://script.google.com/macros/s/…/exec"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        autoFocus={!initial?.url}
      />
      <InputField
        label="Access key"
        optional
        tone={tone}
        hint="Only if you set ACCESS_KEY in the script's properties."
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        value={accessKey}
        onChange={(e) => setAccessKey(e.target.value)}
      />
      <InputField label="Name this library" optional tone={tone} placeholder="Defaults to the sheet's title" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" block loading={busy} disabled={busy || !url.trim()}>
        {busy ? 'Checking…' : submitLabel}
      </Button>
    </form>
  )
}
