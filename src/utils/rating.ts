import type { Rating } from '@/types'

export const RATING_LABELS: Record<Exclude<Rating, null>, string> = {
  1: 'Not for me',
  2: 'It was okay',
  3: 'Liked it',
  4: 'Really liked it',
  5: 'Loved it',
}

/** "Not rated" or the friendly label for a star count ("Loved it"). */
export function ratingCaption(value: Rating): string {
  return value ? RATING_LABELS[value] : 'Not rated'
}
