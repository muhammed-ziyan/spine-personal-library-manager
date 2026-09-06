import { useState } from 'react'
import type { Rating as RatingValue } from '@/types'
import { ratingCaption } from '@/utils/rating'
import styles from './Rating.module.css'

interface RatingProps {
  value: RatingValue
  /** When provided the rating becomes interactive: tap a star, tap again to clear. */
  onChange?: (value: RatingValue) => void
  /** sm 12px (cards) · md 18px (detail tile) · lg 30px (form) */
  size?: 'sm' | 'md' | 'lg'
  label?: string
  /** Show the "Not rated" / "Loved it" caption next to the stars. */
  caption?: boolean
  /** Render nothing at all when unrated (list cards). */
  hideEmpty?: boolean
}

const STARS: Array<Exclude<RatingValue, null>> = [1, 2, 3, 4, 5]

export function Rating({ value, onChange, size = 'sm', label = 'Rating', caption, hideEmpty }: RatingProps) {
  const [hover, setHover] = useState<number | null>(null)
  const interactive = Boolean(onChange)
  const shown = hover ?? value ?? 0

  if (!interactive) {
    if (!value && hideEmpty) return null
    return (
      <span className={[styles.wrap, styles[size]].join(' ')}>
        <span className={styles.stars} role="img" aria-label={value ? `${value} out of 5 stars` : 'Not rated'}>
          {STARS.map((star) => (
            <span key={star} className={star <= (value ?? 0) ? styles.on : styles.off} aria-hidden="true">
              {star <= (value ?? 0) ? '★' : '☆'}
            </span>
          ))}
        </span>
        {caption && <span className={styles.caption}>{ratingCaption(value)}</span>}
      </span>
    )
  }

  return (
    <div className={[styles.wrap, styles[size]].join(' ')} role="radiogroup" aria-label={label} onMouseLeave={() => setHover(null)}>
      <span className={styles.stars}>
        {STARS.map((star) => {
          const on = star <= shown
          const checked = value === star
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              className={[styles.starButton, on ? styles.on : styles.off].join(' ')}
              onMouseEnter={() => setHover(star)}
              onFocus={() => setHover(star)}
              onBlur={() => setHover(null)}
              onClick={() => onChange?.(checked ? null : star)}
            >
              {on ? '★' : '☆'}
            </button>
          )
        })}
      </span>
      {caption && <span className={styles.caption}>{ratingCaption(hover ? (hover as RatingValue) : value)}</span>}
    </div>
  )
}
