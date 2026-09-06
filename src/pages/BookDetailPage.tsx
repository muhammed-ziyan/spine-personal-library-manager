import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookCover, Button, ErrorState, Icon, InlineSpinner, Modal, OptionList, PageHeader, Rating, StatusChip } from '@/components'
import { useLibrary } from '@/hooks/useLibrary'
import { useToast } from '@/hooks/useToast'
import { ApiError, describeError, toApiError } from '@/services/api'
import { BOOK_STATUSES, type Book, type BookStatus, type Rating as RatingValue } from '@/types'
import { formatDate } from '@/utils/format'
import { formatIsbn } from '@/utils/isbn'
import styles from './BookDetailPage.module.css'

export function BookDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getBook, fetchBook, changeStatus, updateBook, deleteBook, books } = useLibrary()
  const toast = useToast()

  const cached = getBook(id)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  useEffect(() => {
    if (cached || loadError) return
    let cancelled = false
    fetchBook(id).catch((err) => {
      if (!cancelled) setLoadError(toApiError(err))
    })
    return () => {
      cancelled = true
    }
  }, [id, cached, loadError, fetchBook])

  const book: Book | undefined = cached
  const otherCopies = book?.isbn ? books.filter((b) => b.isbn === book.isbn && b.id !== book.id) : []

  async function onStatusChange(status: BookStatus) {
    setStatusOpen(false)
    if (!book || book.status === status) return
    try {
      await changeStatus(book.id, status)
      toast.show('Status updated', 'success')
    } catch (err) {
      toast.show(describeError(err), 'danger')
    }
  }

  async function onRatingChange(rating: RatingValue) {
    if (!book) return
    try {
      await updateBook(book.id, { rating })
      toast.show(rating ? 'Rating saved' : 'Rating cleared', 'success')
    } catch (err) {
      toast.show(describeError(err), 'danger')
    }
  }

  async function onDelete() {
    if (!book) return
    setDeleting(true)
    try {
      await deleteBook(book.id)
      toast.show('Book deleted', 'success')
      navigate('/library', { replace: true })
    } catch (err) {
      setDeleting(false)
      setDeleteOpen(false)
      toast.show(describeError(err), 'danger')
    }
  }

  if (loadError) {
    return (
      <main className="page">
        <PageHeader title="Book" back="/library" />
        <ErrorState title="Couldn't open this book" message={describeError(loadError)} onRetry={() => setLoadError(null)} />
      </main>
    )
  }

  if (!book) {
    return (
      <main className="page">
        <PageHeader title="Book" back="/library" />
        <InlineSpinner label="Loading book" />
      </main>
    )
  }

  const details: Array<[string, string]> = [
    ['ISBN', book.isbn ? formatIsbn(book.isbn) : '—'],
    ['Publisher', book.publisher || '—'],
    ['Published', book.publicationYear ? String(book.publicationYear) : '—'],
    ['Edition', book.edition || '—'],
    ['Pages', book.pages ? String(book.pages) : '—'],
    ['Format', book.format || '—'],
    ['Added', formatDate(book.dateAdded)],
    ['Started', book.dateStarted ? formatDate(book.dateStarted) : '—'],
    ['Finished', book.dateFinished ? formatDate(book.dateFinished) : '—'],
  ]

  return (
    <main className="page">
      <PageHeader back="/library" actions={<Button to={`/books/${book.id}/edit`} variant="subtle" size="sm" icon="pencil">Edit</Button>} />

      <section className={styles.hero}>
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} size="lg" />
        <h1 className={styles.title}>{book.title}</h1>
        <p className={styles.author}>{book.author}</p>
        {(book.genre || book.language) && <p className={styles.meta}>{[book.genre, book.language].filter(Boolean).join(' · ')}</p>}
      </section>

      <section className={styles.quick} aria-label="Status and rating">
        <button type="button" className={styles.statusButton} onClick={() => setStatusOpen(true)} aria-haspopup="dialog">
          <span className={styles.quickLabel}>Status</span>
          <span className={styles.statusValue}>
            <StatusChip status={book.status} size="md" />
            <Icon name="chevron-down" size={18} />
          </span>
        </button>
        <div className={styles.ratingBlock}>
          <span className={styles.quickLabel}>Your rating</span>
          <Rating value={book.rating} onChange={(r) => void onRatingChange(r)} size="md" />
        </div>
      </section>

      {book.notes && (
        <section className="section" aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="section-title">
            Notes
          </h2>
          <p className={styles.notes}>{book.notes}</p>
        </section>
      )}

      {otherCopies.length > 0 && (
        <section className="section" aria-labelledby="copies-heading">
          <h2 id="copies-heading" className="section-title">
            Other copies you own
          </h2>
          <ul className={styles.copies}>
            {otherCopies.map((copy) => (
              <li key={copy.id}>
                <Button to={`/books/${copy.id}`} variant="secondary" size="sm" iconRight="chevron-right">
                  {copy.format || 'Copy'} · {copy.status}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <button type="button" className={styles.infoToggle} onClick={() => setInfoOpen((v) => !v)} aria-expanded={infoOpen} aria-controls="book-info">
          <span>Book information</span>
          <Icon name="chevron-down" size={18} className={infoOpen ? styles.chevronOpen : undefined} />
        </button>
        {infoOpen && (
          <dl id="book-info" className={styles.details}>
            {details.map(([label, value]) => (
              <div key={label} className={styles.detailRow}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className={styles.actions} aria-label="Book actions">
        <Button to={`/books/${book.id}/edit`} variant="secondary" size="lg" block icon="pencil">
          Edit Book
        </Button>
        <Button variant="ghost" size="lg" block icon="trash" onClick={() => setDeleteOpen(true)} className={styles.deleteButton}>
          Delete Book
        </Button>
      </section>

      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Reading status">
        <OptionList value={book.status} options={BOOK_STATUSES.map((s) => ({ value: s, label: s }))} onSelect={(s) => void onStatusChange(s)} />
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title="Delete this book?"
        description="This will remove the book from your library."
        variant="dialog"
        hideClose
        actions={
          <>
            <Button variant="danger" onClick={() => void onDelete()} loading={deleting}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
          </>
        }
      />
    </main>
  )
}
