import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookCover, Button, ErrorState, Icon, IconButton, InlineSpinner, Modal, OptionList, PageHeader, Rating, StatusChip } from '@/components'
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
  const [moreOpen, setMoreOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [infoOpen, setInfoOpen] = useState(true)

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
      toast.show(`Marked ${status}`, 'success')
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
        <PageHeader back="/library" />
        <ErrorState title="Couldn't open this book" message={describeError(loadError)} onRetry={() => setLoadError(null)} />
      </main>
    )
  }

  if (!book) {
    return (
      <main className="page">
        <PageHeader back="/library" />
        <div className={styles.loading}>
          <InlineSpinner label="Loading book" />
        </div>
      </main>
    )
  }

  const details: Array<[string, string, boolean?]> = [
    ['ISBN', book.isbn ? formatIsbn(book.isbn) : '—'],
    ['Publisher', book.publisher || '—'],
    ['Published', book.publicationYear ? String(book.publicationYear) : '—'],
    ['Edition', book.edition || '—'],
    ['Pages', book.pages ? String(book.pages) : '—'],
    ['Format', book.format || '—'],
    ['Added', formatDate(book.dateAdded), true],
  ]
  if (book.dateStarted) details.push(['Started', formatDate(book.dateStarted)])
  if (book.dateFinished) details.push(['Finished', formatDate(book.dateFinished)])

  return (
    <main className={['page', 'page--footer', styles.detail].join(' ')}>
      <PageHeader back="/library" actions={<IconButton icon="more" label="More actions" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" />} />

      <section className={styles.hero}>
        <span className={styles.halo} aria-hidden="true" />
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} variant="hero" />
      </section>

      <div className={styles.content}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{book.title}</h1>
          <p className={styles.author}>{book.author}</p>
        </div>

        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Genre</span>
            <span className={styles.tileValue}>{book.genre || '—'}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Language</span>
            <span className={styles.tileValue}>{book.language || '—'}</span>
          </div>
          <button type="button" className={[styles.tile, styles.tileButton].join(' ')} onClick={() => setStatusOpen(true)} aria-haspopup="dialog" aria-label={`Status: ${book.status}. Change`}>
            <span className={styles.tileLabel}>Status</span>
            <span className={styles.tileChip}>
              <StatusChip status={book.status} size="md" caret />
            </span>
          </button>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Rating</span>
            <span className={styles.tileRating}>
              <Rating value={book.rating} onChange={(r) => void onRatingChange(r)} size="md" label="Your rating" />
            </span>
            <span className={styles.tileCaption}>{book.rating ? `${book.rating} of 5` : 'Not rated'}</span>
          </div>
        </div>

        <section className={styles.info}>
          <button type="button" className={styles.infoToggle} onClick={() => setInfoOpen((v) => !v)} aria-expanded={infoOpen} aria-controls="book-info">
            <span>Book information</span>
            <Icon name={infoOpen ? 'chevron-up' : 'chevron-down'} size={18} />
          </button>
          {infoOpen && (
            <dl id="book-info" className={styles.details}>
              {details.map(([label, value, wide]) => (
                <div key={label} className={[styles.detail, wide && styles.detailWide].filter(Boolean).join(' ')}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {otherCopies.length > 0 && (
          <section className={styles.copies} aria-labelledby="copies-heading">
            <h2 id="copies-heading" className="section-title--sm section-title">
              Other copies you own
            </h2>
            <div className={styles.copyList}>
              {otherCopies.map((copy) => (
                <Button key={copy.id} to={`/books/${copy.id}`} variant="secondary" size="sm" iconRight="chevron-right">
                  {copy.format || 'Copy'} · {copy.status}
                </Button>
              ))}
            </div>
          </section>
        )}

        {book.notes && (
          <section className={styles.notes} aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="section-title section-title--sm">
              Notes
            </h2>
            <p className={styles.notesText}>{book.notes}</p>
          </section>
        )}
      </div>

      <div className="page-footer">
        <Button to={`/books/${book.id}/edit`} size="md" className={styles.editButton}>
          Edit Book
        </Button>
        <Button variant="secondary" icon="trash" onClick={() => setDeleteOpen(true)} className={styles.trashButton} aria-label="Delete book" />
      </div>

      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Reading status">
        <OptionList value={book.status} options={BOOK_STATUSES.map((s) => ({ value: s, label: s }))} onSelect={(s) => void onStatusChange(s)} />
      </Modal>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title={book.title}>
        <div className={styles.moreActions}>
          <Button variant="subtle" icon="pencil" block to={`/books/${book.id}/edit`} onClick={() => setMoreOpen(false)}>
            Edit book
          </Button>
          {book.isbn && (
            <Button variant="subtle" icon="copy" block to={`/books/new?isbn=${book.isbn}&copy=1`} onClick={() => setMoreOpen(false)}>
              Add another copy
            </Button>
          )}
          <Button
            variant="ghost"
            icon="trash"
            block
            className={styles.deleteAction}
            onClick={() => {
              setMoreOpen(false)
              setDeleteOpen(true)
            }}
          >
            Delete book
          </Button>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        variant="dialog"
        icon="trash"
        title="Delete this book?"
        description={`“${book.title}” will be removed from your library and your sheet. Your notes go with it.`}
        actions={
          <>
            <Button variant="danger" onClick={() => void onDelete()} loading={deleting} block>
              Delete Book
            </Button>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting} block>
              Keep It
            </Button>
          </>
        }
      />
    </main>
  )
}
