import { useState } from 'react'
import type { Rating as RatingValue } from '@/types'
import { Icon } from './Icon'
import styles from './Rating.module.css'

interface RatingProps {
  value: RatingValue
  /** When provided the rating becomes interactive. */
  onChange?: (value: RatingValue) => void
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const STARS: Array<Exclude<RatingValue, null>> = [1, 2, 3, 4, 5]
const iconSize = { sm: 14, md: 20, lg: 28 }

export function Rating({ value, onChange, size = 'sm', label = 'Rating' }: RatingProps) {
  const [hover, setHover] = useState<number | null>(null)
  const interactive = Boolean(onChange)
  const shown = hover ?? value ?? 0

  if (!interactive) {
    if (!value) return <span className={[styles.rating, styles[size], styles.unrated].join(' ')}>Not rated</span>
    return (
      <span className={[styles.rating, styles[size]].join(' ')} role="img" aria-label={`${value} out of 5 stars`}>
        {STARS.map((star) => (
          <Icon key={star} name={star <= value ? 'star-filled' : 'star'} size={iconSize[size]} className={star <= value ? styles.on : styles.off} />
        ))}
      </span>
    )
  }

  return (
    <div className={[styles.rating, styles[size], styles.interactive].join(' ')} role="radiogroup" aria-label={label} onMouseLeave={() => setHover(null)}>
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
            className={styles.starButton}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(null)}
            onClick={() => onChange?.(checked ? null : star)}
          >
            <Icon name={on ? 'star-filled' : 'star'} size={iconSize[size]} className={on ? styles.on : styles.off} />
          </button>
        )
      })}
      <button type="button" className={styles.clear} onClick={() => onChange?.(null)} disabled={value === null}>
        {value === null ? 'Not rated' : 'Clear'}
      </button>
    </div>
  )
}
