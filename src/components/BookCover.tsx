import { useState, type CSSProperties } from 'react'
import { coverPalette } from '@/utils/format'
import styles from './BookCover.module.css'

interface BookCoverProps {
  title: string
  author?: string
  coverUrl?: string
  /** row 46×64 · edit 52×74 · sheet 60×86 · hero 150×222 · grid fills its column at 2:3 */
  variant?: 'row' | 'edit' | 'sheet' | 'hero' | 'grid'
  /** Tilt the hero cover, as on the "Added to your library" moment. */
  tilt?: boolean
  className?: string
}

/**
 * Renders the book's cover if a URL exists, otherwise a generated placeholder
 * tinted from the tonal ramps with the title set in the heading face.
 */
export function BookCover({ title, author = '', coverUrl, variant = 'row', tilt, className }: BookCoverProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(coverUrl) && !failed
  const palette = coverPalette(`${title}${author}`)
  const style = { '--cover-bg': palette.bg, '--cover-fg': palette.fg } as CSSProperties

  return (
    <div className={[styles.cover, styles[variant], tilt && styles.tilt, className].filter(Boolean).join(' ')} style={style} aria-hidden={showImage ? undefined : true}>
      {showImage ? (
        <img src={coverUrl} alt={`Cover of ${title}`} loading="lazy" onError={() => setFailed(true)} referrerPolicy="no-referrer" />
      ) : (
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          {variant === 'hero' && author && <span className={styles.author}>{author}</span>}
        </span>
      )}
    </div>
  )
}
