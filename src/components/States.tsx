import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { Button } from './Button'
import styles from './States.module.css'

interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ icon = 'book', title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={[styles.state, compact && styles.compact].filter(Boolean).join(' ')}>
      <span className={styles.iconWrap}>
        <Icon name={icon} size={28} />
      </span>
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
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
      <span className={[styles.iconWrap, styles.danger].join(' ')}>
        <Icon name="alert" size={28} />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{message}</p>
      {onRetry && (
        <div className={styles.action}>
          <Button variant="secondary" icon="refresh" onClick={onRetry}>
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
          <Skeleton width="3.25rem" height="4.875rem" radius="0.5rem" />
          <div className={styles.skeletonLines}>
            <Skeleton width="70%" height="1rem" />
            <Skeleton width="45%" height="0.8rem" />
            <Skeleton width="30%" height="0.7rem" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function InlineSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className={styles.spinnerWrap} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
