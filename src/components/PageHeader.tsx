import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton } from './Button'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  /** Omit when the page renders its own h1 elsewhere (e.g. book detail hero). */
  title?: string
  eyebrow?: string
  back?: boolean | string
  actions?: ReactNode
  /** Larger display title for top-level screens. */
  display?: boolean
}

export function PageHeader({ title, eyebrow, back, actions, display }: PageHeaderProps) {
  const navigate = useNavigate()
  const goBack = () => {
    if (typeof back === 'string') navigate(back)
    else if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <header className={[styles.header, display && styles.display].filter(Boolean).join(' ')}>
      {back && <IconButton icon="chevron-left" label="Back" tone="surface" onClick={goBack} className={styles.back} />}
      <div className={styles.text}>
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        {title && <h1 className={display ? styles.displayTitle : styles.title}>{title}</h1>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
