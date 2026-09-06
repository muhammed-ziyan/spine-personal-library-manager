import type { Book, BookStatus, SortKey } from '@/types'
import { normalizeIsbn } from '@/utils/isbn'

export interface LibraryFilters {
  query: string
  status: BookStatus | null
  genre: string | null
  language: string | null
  sort: SortKey
  direction: 'asc' | 'desc'
}

export const DEFAULT_FILTERS: LibraryFilters = {
  query: '',
  status: null,
  genre: null,
  language: null,
  sort: 'dateAdded',
  direction: 'desc',
}

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'dateAdded', label: 'Date added' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'rating', label: 'Rating' },
]

/** Sensible default direction for each key: newest / best first, A→Z for text. */
export function defaultDirection(sort: SortKey): 'asc' | 'desc' {
  return sort === 'dateAdded' || sort === 'rating' ? 'desc' : 'asc'
}

function matchesQuery(book: Book, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q)) return true
  const isbnQuery = normalizeIsbn(q)
  return isbnQuery.length >= 4 && book.isbn.includes(isbnQuery)
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

/** Surname-first-ish comparison isn't attempted; authors sort by the string as entered. */
function compare(a: Book, b: Book, sort: SortKey): number {
  switch (sort) {
    case 'title':
      return collator.compare(a.title, b.title)
    case 'author':
      return collator.compare(a.author, b.author) || collator.compare(a.title, b.title)
    case 'rating':
      return (a.rating ?? 0) - (b.rating ?? 0) || collator.compare(a.title, b.title)
    case 'dateAdded':
    default:
      return a.dateAdded < b.dateAdded ? -1 : a.dateAdded > b.dateAdded ? 1 : 0
  }
}

export function applyFilters(books: Book[], filters: LibraryFilters): Book[] {
  const result = books.filter(
    (book) =>
      (!filters.status || book.status === filters.status) &&
      (!filters.genre || book.genre === filters.genre) &&
      (!filters.language || book.language === filters.language) &&
      matchesQuery(book, filters.query),
  )
  result.sort((a, b) => {
    const order = compare(a, b, filters.sort)
    return filters.direction === 'asc' ? order : -order
  })
  return result
}

/** Distinct values present in the library, sorted with counts. */
export function distinctValues(books: Book[], key: 'genre' | 'language'): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>()
  for (const book of books) {
    const value = book[key].trim()
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => collator.compare(a.value, b.value))
}
