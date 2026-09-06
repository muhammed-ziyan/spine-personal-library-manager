import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, TextButton } from './Button'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title?: string
  /** Round back chevron (`true` = history back, or a path). */
  back?: boolean | string
  /** Round close cross instead of a back chevron. */
  close?: boolean | string
  /** "Cancel" text at the left, as on the edit screen. */
  cancel?: boolean | string
  /** Trailing content at the right (view toggle, avatar…). */
  actions?: ReactNode
  /** 34px display title for tab roots; otherwise a centred 22px title. */
  display?: boolean
  /** Leading content next to a display title (the logo bars). */
  leading?: ReactNode
  /** Custom aria-label for the leading control. */
  backLabel?: string
}

export function PageHeader({ title, back, close, cancel, actions, display, leading, backLabel }: PageHeaderProps) {
  const navigate = useNavigate()
  const target = back ?? close ?? cancel
  const goBack = () => {
    if (typeof target === 'string') navigate(target)
    else if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  if (display) {
    return (
      <header className={styles.display}>
        <div className={styles.displayText}>
          {leading}
          {title && <h1 className={styles.displayTitle}>{title}</h1>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
    )
  }

  const leadingControl = cancel ? (
    <TextButton onClick={goBack}>Cancel</TextButton>
  ) : close ? (
    <IconButton icon="close" label={backLabel ?? 'Close'} onClick={goBack} />
  ) : back ? (
    <IconButton icon="chevron-left" label={backLabel ?? 'Back'} onClick={goBack} />
  ) : (
    <span className={styles.spacer} />
  )

  return (
    <header className={styles.compact}>
      <div className={[styles.side, cancel && styles.sideWide].filter(Boolean).join(' ')}>{leadingControl}</div>
      {title && <h1 className={styles.title}>{title}</h1>}
      <div className={[styles.side, styles.sideEnd, cancel && styles.sideWide].filter(Boolean).join(' ')}>{actions ?? <span className={styles.spacer} />}</div>
    </header>
  )
}
