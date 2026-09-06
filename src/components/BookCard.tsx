import { Link } from 'react-router-dom'
import type { Book } from '@/types'
import { BookCover } from './BookCover'
import { StatusChip } from './Chips'
import { Rating } from './Rating'
import styles from './BookCard.module.css'

interface BookCardProps {
  book: Book
  layout?: 'list' | 'grid'
}

/** Lightweight card: title, author, genre, language, status, optional rating and cover. */
export function BookCard({ book, layout = 'list' }: BookCardProps) {
  const meta = [book.genre, book.language].filter(Boolean).join(' · ')

  if (layout === 'grid') {
    return (
      <Link to={`/books/${book.id}`} className={[styles.card, styles.grid].join(' ')}>
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} size="fill" />
        <div className={styles.gridBody}>
          <h3 className={styles.gridTitle}>{book.title}</h3>
          <p className={styles.author}>{book.author}</p>
          <div className={styles.gridFooter}>
            <StatusChip status={book.status} />
            {book.rating && <Rating value={book.rating} size="sm" />}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link to={`/books/${book.id}`} className={[styles.card, styles.list].join(' ')}>
      <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} size="sm" />
      <div className={styles.body}>
        <h3 className={styles.title}>{book.title}</h3>
        <p className={styles.author}>{book.author}</p>
        {meta && <p className={styles.meta}>{meta}</p>}
        <div className={styles.footer}>
          <StatusChip status={book.status} />
          {book.rating && <Rating value={book.rating} size="sm" />}
        </div>
      </div>
    </Link>
  )
}
