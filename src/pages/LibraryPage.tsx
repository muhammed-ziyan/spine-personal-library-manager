import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookCard, BookCardSkeleton, Button, ChipRow, DropdownChip, EmptyState, ErrorState, FilterChip, Icon, PageHeader, SearchBar } from '@/components'
import { useLibrary } from '@/hooks/useLibrary'
import { usePreferences } from '@/hooks/usePreferences'
import { describeError } from '@/services/api'
import { BOOK_STATUSES, isBookStatus, type SortKey } from '@/types'
import { applyFilters, defaultDirection, distinctValues, isFiltered, SORT_OPTIONS, type LibraryFilters } from '@/features/library/filter'
import { FilterSheet, type FilterDraft } from '@/features/library/FilterSheet'
import { pluralize } from '@/utils/format'
import styles from './LibraryPage.module.css'

const RECENT_KEY = 'spine.recentSearches'
const RECENT_MAX = 5

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

type Patch = Partial<Record<'q' | 'status' | 'sort', string | null>> & { genre?: string[]; language?: string[] }

export function LibraryPage() {
  const { books, stats, state, error, refresh } = useLibrary()
  const { defaultView } = usePreferences()
  const [params, setParams] = useSearchParams()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [view, setView] = useState<'list' | 'grid'>(defaultView)
  const [recent, setRecent] = useState<string[]>(readRecent)

  const filters = useMemo<LibraryFilters>(() => {
    const status = params.get('status')
    const sort = params.get('sort')
    const sortKey: SortKey = sort === 'title' || sort === 'author' || sort === 'rating' ? sort : 'dateAdded'
    const direction = params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : defaultDirection(sortKey)
    return {
      query: params.get('q') ?? '',
      status: isBookStatus(status) ? status : null,
      genres: params.getAll('genre').filter(Boolean),
      languages: params.getAll('language').filter(Boolean),
      sort: sortKey,
      direction,
    }
  }, [params])

  const setFilter = useCallback(
    (patch: Patch) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(patch)) {
            next.delete(key)
            if (Array.isArray(value)) value.forEach((v) => next.append(key, v))
            else if (value) next.set(key, value)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const rememberSearch = useCallback((query: string) => {
    const q = query.trim()
    if (!q) return
    setRecent((current) => {
      const next = [q, ...current.filter((v) => v.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX)
      writeRecent(next)
      return next
    })
  }, [])

  const results = useMemo(() => applyFilters(books, filters), [books, filters])
  const genres = useMemo(() => distinctValues(books, 'genre'), [books])
  const languages = useMemo(() => distinctValues(books, 'language'), [books])
  const loading = state === 'loading' || state === 'idle'
  const searching = filters.query.trim() !== ''
  const sortShort = SORT_OPTIONS.find((o) => o.value === filters.sort)?.short ?? 'Sort'
  const statusCount = (status: (typeof BOOK_STATUSES)[number]) => stats?.byStatus[status]

  const clearFilters = () => setFilter({ q: null, status: null, genre: [], language: [] })

  const applySheet = (draft: FilterDraft) => {
    setFilter({ genre: draft.genres, language: draft.languages, sort: draft.sort === 'dateAdded' ? null : draft.sort })
    setSheetOpen(false)
  }

  const viewToggle = (
    <div className={styles.viewToggle} role="group" aria-label="View">
      <button type="button" className={[styles.viewButton, view === 'list' && styles.viewActive].filter(Boolean).join(' ')} onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="List view">
        <Icon name="list" size={16} />
      </button>
      <button type="button" className={[styles.viewButton, view === 'grid' && styles.viewActive].filter(Boolean).join(' ')} onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view">
        <Icon name="grid" size={16} />
      </button>
    </div>
  )

  let body
  if (state === 'error' && error) {
    body = <ErrorState title="Couldn't load your library" message={describeError(error)} onRetry={() => void refresh()} />
  } else if (loading) {
    body = <BookCardSkeleton count={5} />
  } else if (books.length === 0) {
    body = (
      <EmptyState
        illustration
        title="Your Spine is empty"
        description="Start adding the books you own. Scanning takes a few seconds per book."
        action={
          <>
            <Button to="/scan" icon="scan" size="xl" block>
              Scan Your First Book
            </Button>
            <Button to="/books/new" variant="ghost" block>
              Add Manually
            </Button>
          </>
        }
      />
    )
  } else if (results.length === 0) {
    body = (
      <EmptyState
        icon="search"
        compact
        title="No books match"
        description={searching ? 'Try a different word, or check the spelling.' : 'Try different filters, or clear them.'}
        action={
          <Button variant="secondary" onClick={clearFilters}>
            {searching ? 'Clear search' : 'Clear filters'}
          </Button>
        }
      />
    )
  } else {
    body = (
      <ul className={view === 'grid' && !searching ? styles.grid : styles.list} onClickCapture={searching ? () => rememberSearch(filters.query) : undefined}>
        {results.map((book) => (
          <li key={book.id}>
            <BookCard book={book} layout={searching ? 'list' : view} highlight={searching ? filters.query : undefined} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <main className={['page', 'page--nav', 'page--wide', styles.library].join(' ')}>
      {!searching && <PageHeader display title="Library" actions={viewToggle} />}

      <SearchBar value={filters.query} onChange={(q) => setFilter({ q })} onCommit={rememberSearch} onCancel={() => setFilter({ q: null })} />

      {searching ? (
        !loading &&
        results.length > 0 && (
          <p className={styles.resultCount} role="status">
            {pluralize(results.length, 'result')} · matching title, author or ISBN
          </p>
        )
      ) : (
        <>
          <ChipRow label="Filter by status">
            <FilterChip selected={!filters.status} onClick={() => setFilter({ status: null })} count={filters.status ? undefined : stats?.total}>
              All
            </FilterChip>
            {BOOK_STATUSES.map((status) => (
              <FilterChip key={status} selected={filters.status === status} onClick={() => setFilter({ status: filters.status === status ? null : status })} count={filters.status === status ? statusCount(status) : undefined}>
                {status}
              </FilterChip>
            ))}
          </ChipRow>
          <div className={styles.filterRow}>
            <DropdownChip active={filters.genres.length > 0} onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
              {filters.genres.length === 1 ? filters.genres[0] : filters.genres.length > 1 ? `Genre · ${filters.genres.length}` : 'Genre'}
            </DropdownChip>
            <DropdownChip active={filters.languages.length > 0} onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
              {filters.languages.length === 1 ? filters.languages[0] : filters.languages.length > 1 ? `Language · ${filters.languages.length}` : 'Language'}
            </DropdownChip>
            <DropdownChip icon="sort" className={styles.sortChip} onClick={() => setSheetOpen(true)} aria-haspopup="dialog" aria-label={`Sort by ${sortShort}`}>
              {sortShort}
            </DropdownChip>
          </div>
          {isFiltered(filters) && !loading && books.length > 0 && results.length > 0 && (
            <p className={styles.resultCount} role="status">
              <span>{pluralize(results.length, 'book')}</span>
              <button type="button" className={styles.clear} onClick={clearFilters}>
                Clear filters
              </button>
            </p>
          )}
        </>
      )}

      {body}

      {searching && recent.length > 0 && (
        <div className={styles.recent}>
          <div className={styles.recentLabel}>Recent searches</div>
          <div className={styles.recentChips}>
            {recent.map((term) => (
              <button key={term} type="button" className={styles.recentChip} onClick={() => setFilter({ q: term })}>
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} books={books} filters={filters} genres={genres} languages={languages} onApply={applySheet} />
    </main>
  )
}
