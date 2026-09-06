import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { Button } from './Button'
import styles from './States.module.css'

interface EmptyStateProps {
  icon?: IconName
  /** Draw the three-books illustration instead of an icon (empty library). */
  illustration?: boolean
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ icon = 'library', illustration, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={[styles.state, compact && styles.compact].filter(Boolean).join(' ')}>
      {illustration ? (
        <span className={styles.illustration} aria-hidden="true">
          <span className={styles.book1} />
          <span className={styles.book2} />
          <span className={styles.book3} />
        </span>
      ) : (
        <span className={styles.iconWrap}>
          <Icon name={icon} size={30} />
        </span>
      )}
      <div>
        <h2 className={compact ? styles.titleSm : styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  compact?: boolean
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again', compact }: ErrorStateProps) {
  return (
    <div className={[styles.state, compact && styles.compact].filter(Boolean).join(' ')} role="alert">
      <span className={[styles.iconWrap, styles.warn].join(' ')}>
        <Icon name="alert" size={30} />
      </span>
      <div>
        <h2 className={styles.titleSm}>{title}</h2>
        <p className={styles.description}>{message}</p>
      </div>
      {onRetry && (
        <div className={styles.action}>
          <Button variant="secondary" icon="refresh" onClick={onRetry} block>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

interface SkeletonProps {
  width?: string
  height?: string
  radius?: string
  className?: string
}

export function Skeleton({ width = '100%', height = '1rem', radius = 'var(--radius-sm)', className }: SkeletonProps) {
  return <span className={[styles.skeleton, className].filter(Boolean).join(' ')} style={{ width, height, borderRadius: radius }} aria-hidden="true" />
}

/** Skeleton shaped like a list BookCard. */
export function BookCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.skeletonList} role="status" aria-live="polite" aria-label="Loading books">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <Skeleton width="46px" height="64px" radius="8px" />
          <div className={styles.skeletonLines}>
            <Skeleton width="70%" height="14px" />
            <Skeleton width="45%" height="12px" />
            <Skeleton width="30%" height="11px" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function InlineSpinner({ label = 'Loading', size = 28 }: { label?: string; size?: number }) {
  return (
    <span className={styles.spinnerWrap} role="status">
      <span className={styles.spinner} style={{ width: size, height: size }} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
