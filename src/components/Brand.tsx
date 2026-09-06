import styles from './Brand.module.css'

/** The three-spine mark used next to the Home title (28px) and on the launch screen (120px). */
export function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <span className={[styles.logo, styles[size]].join(' ')} aria-hidden="true">
      <span className={styles.bar1} />
      <span className={styles.bar2} />
      <span className={styles.bar3} />
      {size === 'lg' && <span className={styles.bar4} />}
    </span>
  )
}

interface SplashProps {
  /** Status line under the dots ("Syncing your library…"). */
  status?: string
}

/** Full-screen terracotta launch screen, shown while signing in and syncing. */
export function Splash({ status = 'Syncing your library…' }: SplashProps) {
  return (
    <div className={styles.splash} role="status" aria-live="polite">
      <span className={styles.blobTop} aria-hidden="true" />
      <span className={styles.blobBottom} aria-hidden="true" />
      <div className={styles.splashBody}>
        <Logo size="lg" />
        <div className={styles.splashText}>
          <div className={styles.wordmark}>Spine</div>
          <div className={styles.tagline}>Every book you own, in your pocket.</div>
        </div>
      </div>
      <div className={styles.splashFooter}>
        <span className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <div className={styles.status}>{status}</div>
      </div>
    </div>
  )
}

/** 40px round avatar with the user's initial in the heading face, or their photo. */
export function Avatar({ name, picture, size = 'sm' }: { name?: string; picture?: string; size?: 'sm' | 'lg' }) {
  const initial = (name?.trim()[0] ?? '?').toUpperCase()
  return (
    <span className={[styles.avatar, size === 'lg' && styles.avatarLg].filter(Boolean).join(' ')} aria-hidden="true">
      {picture ? <img src={picture} alt="" referrerPolicy="no-referrer" /> : initial}
    </span>
  )
}
