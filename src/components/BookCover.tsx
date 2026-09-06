import { useState } from 'react'
import { hueFrom, initials } from '@/utils/format'
import styles from './BookCover.module.css'

interface BookCoverProps {
  title: string
  author?: string
  coverUrl?: string
  size?: 'sm' | 'md' | 'lg' | 'fill'
}

/**
 * Renders the book's cover if a URL exists, otherwise a warm, deterministic
 * placeholder "spine" so the library still looks intentional without images.
 */
export function BookCover({ title, author = '', coverUrl, size = 'sm' }: BookCoverProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(coverUrl) && !failed
  const hue = hueFrom(`${title}${author}`)

  return (
    <div
      className={[styles.cover, styles[size]].join(' ')}
      style={{ '--cover-hue': hue } as React.CSSProperties}
      aria-hidden={showImage ? undefined : true}
    >
      {showImage ? (
        <img src={coverUrl} alt={`Cover of ${title}`} loading="lazy" onError={() => setFailed(true)} referrerPolicy="no-referrer" />
      ) : (
        <span className={styles.monogram}>{initials(title)}</span>
      )}
      <span className={styles.edge} aria-hidden="true" />
    </div>
  )
}
