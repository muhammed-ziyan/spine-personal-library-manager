import { Link } from 'react-router-dom'
import type { Book } from '@/types'
import { BookCover } from './BookCover'
import { StatusChip } from './Chips'
import { Rating } from './Rating'
import styles from './BookCard.module.css'

interface BookCardProps {
  book: Book
  layout?: 'list' | 'grid'
  /** Search query to highlight inside title, author, genre and language. */
  highlight?: string
  /** Show the genre line without the language (Home's "Recently added"). */
  genreOnly?: boolean
}

/** Wraps the matching fragment in a tinted mark. */
export function Highlight({ text, query }: { text: string; query?: string }) {
  const q = query?.trim()
  if (!q) return <>{text}</>
  const index = text.toLowerCase().indexOf(q.toLowerCase())
  if (index < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark className={styles.mark}>{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  )
}

/** Lightweight card: cover, title, author, genre · language, status and rating. Never ISBN, publisher, pages or date. */
export function BookCard({ book, layout = 'list', highlight, genreOnly }: BookCardProps) {
  if (layout === 'grid') {
    return (
      <Link to={`/books/${book.id}`} className={styles.grid}>
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} variant="grid" />
        <span className={styles.gridTitle}>
          <Highlight text={book.title} query={highlight} />
        </span>
        <span className={styles.gridAuthor}>
          <Highlight text={book.author} query={highlight} />
        </span>
      </Link>
    )
  }

  const metaParts = genreOnly ? [book.genre] : [book.genre, book.language]
  const meta = metaParts.filter(Boolean)

  return (
    <Link to={`/books/${book.id}`} className={styles.row}>
      <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} variant="row" />
      <span className={styles.body}>
        <span className={styles.title}>
          <Highlight text={book.title} query={highlight} />
        </span>
        <span className={styles.author}>
          <Highlight text={book.author} query={highlight} />
        </span>
        {meta.length > 0 && (
          <span className={styles.meta}>
            {meta.map((part, i) => (
              <span key={part}>
                {i > 0 && ' · '}
                <Highlight text={part} query={highlight} />
              </span>
            ))}
          </span>
        )}
      </span>
      <span className={styles.trailing}>
        <StatusChip status={book.status} />
        <Rating value={book.rating} size="sm" hideEmpty />
      </span>
    </Link>
  )
}
