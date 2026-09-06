import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookCard, BookCardSkeleton, Button, ChipRow, DropdownChip, EmptyState, ErrorState, FilterChip, IconButton, Modal, OptionList, PageHeader, SearchBar } from '@/components'
import { useLibrary } from '@/hooks/useLibrary'
import { describeError } from '@/services/api'
import { BOOK_STATUSES, isBookStatus, type SortKey } from '@/types'
import { applyFilters, defaultDirection, distinctValues, SORT_OPTIONS, type LibraryFilters } from '@/features/library/filter'
import { pluralize } from '@/utils/format'
import styles from './LibraryPage.module.css'

type Sheet = 'genre' | 'language' | 'sort' | null

const VIEW_KEY = 'spine.libraryView'

function readView(): 'list' | 'grid' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

export function LibraryPage() {
  const { books, stats, state, error, refresh } = useLibrary()
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [view, setView] = useState<'list' | 'grid'>(readView)

  const filters = useMemo<LibraryFilters>(() => {
    const status = params.get('status')
    const sort = params.get('sort')
    const sortKey: SortKey = sort === 'title' || sort === 'author' || sort === 'rating' ? sort : 'dateAdded'
    const direction = params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : defaultDirection(sortKey)
    return {
      query: params.get('q') ?? '',
      status: isBookStatus(status) ? status : null,
      genre: params.get('genre') || null,
      language: params.get('language') || null,
      sort: sortKey,
      direction,
    }
  }, [params])

  const setFilter = useCallback(
    (patch: Partial<Record<'q' | 'status' | 'genre' | 'language' | 'sort' | 'dir', string | null>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const changeView = (next: 'list' | 'grid') => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* ignore */
    }
  }

  const results = useMemo(() => applyFilters(books, filters), [books, filters])
  const genres = useMemo(() => distinctValues(books, 'genre'), [books])
  const languages = useMemo(() => distinctValues(books, 'language'), [books])
  const loading = state === 'loading' || state === 'idle'
  const filtered = Boolean(filters.query || filters.status || filters.genre || filters.language)
  const sortLabel = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? 'Sort'

  const clearFilters = () => setFilter({ q: null, status: null, genre: null, language: null })

  return (
    <main className="page page--wide">
      <PageHeader
        title="Library"
        display
        actions={
          <>
            <IconButton icon="sort" label={`Sort by ${sortLabel}`} onClick={() => setSheet('sort')} />
            <IconButton icon={view === 'list' ? 'grid' : 'list'} label={view === 'list' ? 'Switch to grid view' : 'Switch to list view'} onClick={() => changeView(view === 'list' ? 'grid' : 'list')} />
          </>
        }
      />

      <div className={styles.controls}>
        <SearchBar value={filters.query} onChange={(q) => setFilter({ q })} />
        <ChipRow label="Filter by status">
          <FilterChip selected={!filters.status} onClick={() => setFilter({ status: null })} count={stats?.total}>
            All
          </FilterChip>
          {BOOK_STATUSES.map((status) => (
            <FilterChip key={status} selected={filters.status === status} onClick={() => setFilter({ status: filters.status === status ? null : status })} count={stats?.byStatus[status]}>
              {status}
            </FilterChip>
          ))}
          <DropdownChip active={Boolean(filters.genre)} onClick={() => setSheet('genre')} aria-haspopup="dialog">
            {filters.genre ?? 'Genre'}
          </DropdownChip>
          <DropdownChip active={Boolean(filters.language)} onClick={() => setSheet('language')} aria-haspopup="dialog">
            {filters.language ?? 'Language'}
          </DropdownChip>
        </ChipRow>
      </div>

      {state === 'error' && error ? (
        <ErrorState title="Couldn't load your library" message={describeError(error)} onRetry={() => void refresh()} />
      ) : loading ? (
        <BookCardSkeleton count={5} />
      ) : books.length === 0 ? (
        <EmptyState
          title="Your library is empty"
          description="Start adding the books you own."
          action={
            <Button to="/scan" icon="scan" size="lg">
              Scan Your First Book
            </Button>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon="search"
          title="No books match"
          description="Try a different search or clear your filters."
          compact
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <p className={styles.resultCount} role="status">
            <span>{pluralize(results.length, 'book')}</span>
            {filtered && (
              <button type="button" className={styles.clear} onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </p>
          <ul className={view === 'grid' ? styles.grid : styles.list}>
            {results.map((book) => (
              <li key={book.id}>
                <BookCard book={book} layout={view} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal open={sheet === 'genre'} onClose={() => setSheet(null)} title="Genre">
        {genres.length === 0 ? (
          <p className="muted">No genres yet — add a genre to a book to filter by it.</p>
        ) : (
          <OptionList
            value={filters.genre ?? '__all'}
            options={[{ value: '__all', label: 'All genres' }, ...genres.map((g) => ({ value: g.value, label: g.value, hint: String(g.count) }))]}
            onSelect={(value) => {
              setFilter({ genre: value === '__all' ? null : value })
              setSheet(null)
            }}
          />
        )}
      </Modal>

      <Modal open={sheet === 'language'} onClose={() => setSheet(null)} title="Language">
        {languages.length === 0 ? (
          <p className="muted">No languages yet — add a language to a book to filter by it.</p>
        ) : (
          <OptionList
            value={filters.language ?? '__all'}
            options={[{ value: '__all', label: 'All languages' }, ...languages.map((l) => ({ value: l.value, label: l.value, hint: String(l.count) }))]}
            onSelect={(value) => {
              setFilter({ language: value === '__all' ? null : value })
              setSheet(null)
            }}
          />
        )}
      </Modal>

      <Modal open={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort by">
        <OptionList
          value={filters.sort}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onSelect={(value) => {
            setFilter({ sort: value, dir: null })
            setSheet(null)
          }}
        />
        <div className={styles.direction} role="group" aria-label="Direction">
          <FilterChip selected={filters.direction === 'asc'} onClick={() => setFilter({ dir: 'asc' })}>
            {filters.sort === 'dateAdded' ? 'Oldest first' : filters.sort === 'rating' ? 'Lowest first' : 'A → Z'}
          </FilterChip>
          <FilterChip selected={filters.direction === 'desc'} onClick={() => setFilter({ dir: 'desc' })}>
            {filters.sort === 'dateAdded' ? 'Newest first' : filters.sort === 'rating' ? 'Highest first' : 'Z → A'}
          </FilterChip>
        </div>
      </Modal>
    </main>
  )
}
