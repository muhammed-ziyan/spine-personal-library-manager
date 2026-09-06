import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, ErrorState, InlineSpinner, PageHeader } from '@/components'
import { BookForm } from '@/features/books/BookForm'
import { DuplicateSheet } from '@/features/books/DuplicateSheet'
import { useLibrary } from '@/hooks/useLibrary'
import { useToast } from '@/hooks/useToast'
import { ApiError, describeError, toApiError } from '@/services/api'
import type { Book, BookInput, DuplicateMatch } from '@/types'
import { parseIsbn } from '@/utils/isbn'
import { emptyBookInput } from '@/utils/validation'
import styles from './BookFormPage.module.css'

function toInput(book: Book): BookInput {
  const { id: _id, dateAdded: _da, updatedAt: _ua, dateStarted: _ds, dateFinished: _df, ...input } = book
  return input
}

export function BookFormPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { genres, getBook, fetchBook, addBook, updateBook } = useLibrary()
  const toast = useToast()

  const editing = Boolean(id)
  const scannedIsbn = useMemo(() => (editing ? '' : parseIsbn(params.get('isbn')).isbn), [editing, params])
  const explicitCopy = params.get('copy') === '1'

  const [existing, setExisting] = useState<Book | undefined>(() => (id ? getBook(id) : undefined))
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null)
  const [pendingInput, setPendingInput] = useState<BookInput | null>(null)
  const [saveError, setSaveError] = useState<ApiError | null>(null)

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

  const initial = useMemo<BookInput>(() => {
    if (existing) return toInput(existing)
    return emptyBookInput({ isbn: scannedIsbn })
  }, [existing, scannedIsbn])

  async function save(input: BookInput, allowDuplicate: boolean) {
    setPending(true)
    setSaveError(null)
    try {
      if (editing && existing) {
        const book = await updateBook(existing.id, input)
        toast.show('Book updated', 'success')
        navigate(`/books/${book.id}`, { replace: true })
      } else {
        const book = await addBook({ ...input, allowDuplicate })
        toast.show('Added to your library', 'success')
        setDuplicate(null)
        navigate(`/books/${book.id}`, { replace: true })
      }
    } catch (err) {
      const apiError = toApiError(err)
      if (apiError.isDuplicate && apiError.duplicate) {
        setPendingInput(input)
        setDuplicate(apiError.duplicate)
      } else {
        setPendingInput(input)
        setSaveError(apiError)
      }
    } finally {
      setPending(false)
    }
  }

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
        <InlineSpinner label="Loading book" />
      </main>
    )
  }

  return (
    <main className="page">
      <PageHeader title={editing ? 'Edit book' : explicitCopy ? 'Add another copy' : 'New book'} back={editing ? `/books/${id}` : '/add'} />

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

      <BookForm
        key={existing?.id ?? scannedIsbn}
        initial={initial}
        genres={genres}
        submitLabel={editing ? 'Save Changes' : 'Add to Library'}
        pending={pending}
        lockedIsbn={Boolean(scannedIsbn)}
        expanded={editing}
        onSubmit={(input) => void save(input, explicitCopy)}
      />

      <DuplicateSheet
        duplicate={duplicate}
        onClose={() => setDuplicate(null)}
        pending={pending}
        onAddAnother={() => {
          if (pendingInput) void save(pendingInput, true)
        }}
      />
    </main>
  )
}
