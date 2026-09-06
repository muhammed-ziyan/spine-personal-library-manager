import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BookCover, Button, ErrorState, Icon, InlineSpinner, Modal, PageHeader, TextButton } from '@/components'
import { BookForm, type BookFormMode } from '@/features/books/BookForm'
import { DuplicateSheet } from '@/features/books/DuplicateSheet'
import { useLibrary } from '@/hooks/useLibrary'
import { useToast } from '@/hooks/useToast'
import { ApiError, describeError, toApiError } from '@/services/api'
import { describeLookupError, metadataToInput, openLibrary, type BookMetadata } from '@/services/openLibrary'
import type { Book, BookInput, DuplicateMatch } from '@/types'
import { formatDate } from '@/utils/format'
import { formatIsbn, parseIsbn } from '@/utils/isbn'
import { emptyBookInput } from '@/utils/validation'
import styles from './BookFormPage.module.css'

function toInput(book: Book): BookInput {
  const { id: _id, dateAdded: _da, updatedAt: _ua, dateStarted: _ds, dateFinished: _df, ...input } = book
  return input
}

const TITLES: Record<BookFormMode, string> = { scanned: 'New book', manual: 'Add manually', copy: 'Add another copy', edit: 'Edit book' }

/** State of the Open Library lookup that runs for an ISBN we arrived with. */
type Lookup =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'found'; metadata: BookMetadata }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string }

export function BookFormPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { genres, getBook, fetchBook, addBook, updateBook, deleteBook } = useLibrary()
  const toast = useToast()

  const editing = Boolean(id)
  const scannedIsbn = useMemo(() => (editing ? '' : parseIsbn(params.get('isbn')).isbn), [editing, params])
  const explicitCopy = params.get('copy') === '1'
  const mode: BookFormMode = editing ? 'edit' : explicitCopy ? 'copy' : scannedIsbn ? 'scanned' : 'manual'

  const [existing, setExisting] = useState<Book | undefined>(() => (id ? getBook(id) : undefined))
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null)
  const [pendingInput, setPendingInput] = useState<BookInput | null>(null)
  const [saveError, setSaveError] = useState<ApiError | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lookup, setLookup] = useState<Lookup>({ kind: 'idle' })
  const [attempt, setAttempt] = useState(0)
  // The ISBN the user has taken the form over for ("Enter the details myself" /
  // "Clear"), so a late reply can never overwrite what they are typing — and a
  // different ISBN later on still gets looked up.
  const dismissedFor = useRef('')

  useEffect(() => {
    if (!id || existing) return
    let cancelled = false
    fetchBook(id)
      .then((book) => {
        if (!cancelled) setExisting(book)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(toApiError(err))
      })
    return () => {
      cancelled = true
    }
  }, [id, existing, fetchBook])

  // Ask Open Library what this ISBN is before showing an empty form. The
  // scanner usually warms the same request, so this is often already resolved.
  useEffect(() => {
    if (editing || !scannedIsbn || dismissedFor.current === scannedIsbn) return
    let cancelled = false
    const done = () => cancelled || dismissedFor.current === scannedIsbn
    setLookup({ kind: 'loading' })
    openLibrary
      .lookup(scannedIsbn)
      .then((metadata) => {
        if (done()) return
        setLookup(metadata ? { kind: 'found', metadata } : { kind: 'missing' })
      })
      .catch((err) => {
        if (done()) return
        setLookup({ kind: 'failed', message: describeLookupError(err) })
      })
    return () => {
      cancelled = true
    }
  }, [editing, scannedIsbn, attempt])

  const initial = useMemo<BookInput>(() => {
    if (existing) return toInput(existing)
    const prefill = lookup.kind === 'found' ? metadataToInput(lookup.metadata, genres) : {}
    return emptyBookInput({ isbn: scannedIsbn, ...prefill })
  }, [existing, scannedIsbn, lookup, genres])

  /** Drop the suggested details and start from a blank form. */
  function clearPrefill() {
    dismissedFor.current = scannedIsbn
    setLookup({ kind: 'idle' })
  }

  function retryLookup() {
    dismissedFor.current = ''
    setAttempt((n) => n + 1)
  }

  async function save(input: BookInput, allowDuplicate: boolean) {
    setPending(true)
    setSaveError(null)
    try {
      if (editing && existing) {
        const book = await updateBook(existing.id, input)
        toast.show('Changes saved', 'success')
        navigate(`/books/${book.id}`, { replace: true })
      } else {
        const book = await addBook({ ...input, allowDuplicate })
        setDuplicate(null)
        navigate(`/books/${book.id}/added`, { replace: true })
      }
    } catch (err) {
      const apiError = toApiError(err)
      setPendingInput(input)
      if (apiError.isDuplicate && apiError.duplicate) setDuplicate(apiError.duplicate)
      else setSaveError(apiError)
    } finally {
      setPending(false)
    }
  }

  async function onDelete() {
    if (!existing) return
    setDeleting(true)
    try {
      await deleteBook(existing.id)
      toast.show('Book deleted', 'success')
      navigate('/library', { replace: true })
    } catch (err) {
      setDeleting(false)
      setDeleteOpen(false)
      toast.show(describeError(err), 'danger')
    }
  }

  const headerProps = mode === 'edit' ? { cancel: `/books/${id}` } : mode === 'manual' ? { close: '/add' } : { back: '/add' }

  if (editing && loadError) {
    return (
      <main className="page">
        <PageHeader title="Edit book" back />
        <ErrorState message={describeError(loadError)} onRetry={() => setLoadError(null)} />
      </main>
    )
  }

  if (editing && !existing) {
    return (
      <main className="page">
        <PageHeader title="Edit book" back />
        <div className={styles.loading}>
          <InlineSpinner label="Loading book" />
        </div>
      </main>
    )
  }

  // Hold the form back for the moment the lookup takes: filling the fields in
  // underneath the user would be worse than a short, skippable wait.
  if (lookup.kind === 'loading') {
    return (
      <main className={['page', styles.formPage].join(' ')}>
        <PageHeader title={TITLES[mode]} {...headerProps} />
        <div className={styles.lookup} role="status">
          <InlineSpinner label="Looking up this book" />
          <div>
            <p className={styles.lookupTitle}>Looking up ISBN {formatIsbn(scannedIsbn)}</p>
            <p className={styles.lookupHint}>Checking Open Library for the title, author and cover.</p>
          </div>
          <TextButton onClick={clearPrefill}>Enter the details myself</TextButton>
        </div>
      </main>
    )
  }

  return (
    <main className={['page', 'page--footer', styles.formPage].join(' ')}>
      <PageHeader title={TITLES[mode]} {...headerProps} />

      {existing && (
        <div className={styles.meta}>
          <BookCover title={existing.title} author={existing.author} coverUrl={existing.coverUrl} variant="edit" />
          <div className={styles.metaText}>
            {existing.isbn ? `ISBN ${formatIsbn(existing.isbn)}` : 'No ISBN'}
            <br />
            Added {formatDate(existing.dateAdded)}
          </div>
        </div>
      )}

      {saveError && (
        <div className={styles.saveError} role="alert">
          <div>
            <p className={styles.saveErrorTitle}>{editing ? "Changes weren't saved." : "Book wasn't added."}</p>
            <p className={styles.saveErrorText}>{describeError(saveError)}</p>
          </div>
          {pendingInput && (
            <Button size="sm" variant="secondary" icon="refresh" onClick={() => void save(pendingInput, explicitCopy)} loading={pending}>
              Try Again
            </Button>
          )}
        </div>
      )}

      {lookup.kind === 'found' && (
        <div className={styles.prefill}>
          <BookCover title={lookup.metadata.title} author={lookup.metadata.authors[0]} coverUrl={lookup.metadata.coverUrl} variant="edit" />
          <div className={styles.prefillText}>
            <p className={styles.prefillTitle}>Details from Open Library</p>
            <p className={styles.prefillHint}>Have a look before you save — every field is yours to change.</p>
          </div>
          <TextButton tone="muted" onClick={clearPrefill}>
            Clear
          </TextButton>
        </div>
      )}

      {(lookup.kind === 'missing' || lookup.kind === 'failed') && (
        <div className={styles.lookupNote}>
          <Icon name="alert" size={18} />
          <span>{lookup.kind === 'missing' ? "Open Library doesn't have this ISBN. Fill the details in below." : `${lookup.message} Fill the details in below, or try the lookup again.`}</span>
          {lookup.kind === 'failed' && <TextButton onClick={retryLookup}>Retry</TextButton>}
        </div>
      )}

      <BookForm
        key={existing?.id ?? `${scannedIsbn}:${lookup.kind === 'found' ? lookup.metadata.sourceUrl : 'blank'}`}
        mode={mode}
        initial={initial}
        genres={genres}
        submitLabel={editing ? 'Save Changes' : 'Add to Library'}
        pending={pending}
        expanded={editing}
        onSubmit={(input) => void save(input, explicitCopy)}
        onChangeIsbn={() => navigate('/add?enter=isbn')}
        onScan={() => navigate('/scan')}
        onDelete={editing ? () => setDeleteOpen(true) : undefined}
      />

      <DuplicateSheet
        duplicate={duplicate}
        onClose={() => setDuplicate(null)}
        pending={pending}
        onAddAnother={() => {
          if (pendingInput) void save(pendingInput, true)
        }}
      />

      {existing && (
        <Modal
          open={deleteOpen}
          onClose={() => !deleting && setDeleteOpen(false)}
          variant="dialog"
          icon="trash"
          title="Delete this book?"
          description={`“${existing.title}” will be removed from your library and your sheet. Your notes go with it.`}
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
      )}
    </main>
  )
}
