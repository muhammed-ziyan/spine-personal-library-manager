import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookCover, Button, Icon, InlineSpinner } from '@/components'
import { useLibrary } from '@/hooks/useLibrary'
import { useToast } from '@/hooks/useToast'
import styles from './AddedPage.module.css'

/** The success moment after a book is added: cover, tick, then Scan Another / View Book / Done. */
export function AddedPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getBook, fetchBook, books, stats } = useLibrary()
  const toast = useToast()
  const book = getBook(id)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (book || failed) return
    fetchBook(id).catch(() => setFailed(true))
  }, [book, failed, fetchBook, id])

  useEffect(() => {
    if (failed) navigate('/', { replace: true })
  }, [failed, navigate])

  if (!book) {
    return (
      <main className="page">
        <div className={styles.loading}>
          <InlineSpinner label="Loading book" />
        </div>
      </main>
    )
  }

  const total = stats?.total ?? books.length
  const shelf = [book.genre, book.subgenre].filter(Boolean).join(' · ')
  const filed = [shelf ? `Filed under ${shelf}` : null, `marked ${book.status}`].filter(Boolean).join(', ')

  const done = () => {
    toast.show('Added to your library', 'success', { label: 'View', to: `/books/${book.id}` })
    navigate('/', { replace: true })
  }

  return (
    <main className={['page', styles.added].join(' ')}>
      <span className={styles.halo} aria-hidden="true" />
      <div className={styles.coverWrap}>
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} variant="hero" tilt />
        <span className={styles.tick} aria-hidden="true">
          <Icon name="check" size={30} strokeWidth={3} />
        </span>
      </div>
      <div className={styles.text}>
        <h1 className={styles.title}>Added to your library</h1>
        <p className={styles.subtitle}>
          Book {total}. {filed}.
        </p>
      </div>
      <div className={styles.actions}>
        <Button to="/scan" icon="scan" size="lg" block replace>
          Scan Another
        </Button>
        <Button to={`/books/${book.id}`} variant="secondary" block replace>
          View Book
        </Button>
        <Button variant="ghost" block onClick={done}>
          Done
        </Button>
      </div>
    </main>
  )
}
