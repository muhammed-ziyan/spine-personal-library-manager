import { describe, expect, it } from 'vitest'
import type { Book } from '@/types'
import { DEFAULT_FILTERS, applyFilters, distinctValues, isFiltered } from './filter'

function book(overrides: Partial<Book>): Book {
  return {
    id: 'BK-00001',
    isbn: '',
    title: 'Untitled',
    author: 'Anon',
    genre: '',
    subgenre: '',
    language: 'English',
    publisher: '',
    publicationYear: null,
    edition: '',
    pages: null,
    format: '',
    status: 'Unread',
    rating: null,
    dateAdded: '2024-01-01T00:00:00.000Z',
    dateStarted: null,
    dateFinished: null,
    notes: '',
    coverUrl: '',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const books: Book[] = [
  book({ id: 'BK-00001', title: 'Dune', author: 'Frank Herbert', genre: 'Science Fiction', subgenre: 'Space Opera', isbn: '9780441172719', rating: 5, dateAdded: '2024-01-01T00:00:00.000Z', status: 'Read' }),
  book({ id: 'BK-00002', title: 'Beloved', author: 'Toni Morrison', genre: 'Literary Fiction', rating: 4, dateAdded: '2024-02-01T00:00:00.000Z', status: 'Reading' }),
  book({ id: 'BK-00003', title: 'Aadujeevitham', author: 'Benyamin', genre: 'Fiction', language: 'Malayalam', dateAdded: '2024-03-01T00:00:00.000Z' }),
]

describe('applyFilters', () => {
  it('defaults to newest first', () => {
    expect(applyFilters(books, DEFAULT_FILTERS).map((b) => b.id)).toEqual(['BK-00003', 'BK-00002', 'BK-00001'])
  })

  it('searches title, author, genre, language and ISBN', () => {
    expect(applyFilters(books, { ...DEFAULT_FILTERS, query: 'morrison' }).map((b) => b.title)).toEqual(['Beloved'])
    expect(applyFilters(books, { ...DEFAULT_FILTERS, query: 'DUNE' }).map((b) => b.title)).toEqual(['Dune'])
    expect(applyFilters(books, { ...DEFAULT_FILTERS, query: '978-0441' }).map((b) => b.title)).toEqual(['Dune'])
    expect(applyFilters(books, { ...DEFAULT_FILTERS, query: 'sci' }).map((b) => b.title)).toEqual(['Dune'])
    expect(applyFilters(books, { ...DEFAULT_FILTERS, query: 'malayalam' }).map((b) => b.title)).toEqual(['Aadujeevitham'])
  })

  it('searches subgenre too', () => {
    expect(applyFilters(books, { ...DEFAULT_FILTERS, query: 'space opera' }).map((b) => b.title)).toEqual(['Dune'])
  })

  it('filters by status, genres and languages', () => {
    expect(applyFilters(books, { ...DEFAULT_FILTERS, status: 'Reading' })).toHaveLength(1)
    expect(applyFilters(books, { ...DEFAULT_FILTERS, genres: ['Fiction'] }).map((b) => b.title)).toEqual(['Aadujeevitham'])
    expect(applyFilters(books, { ...DEFAULT_FILTERS, genres: ['Fiction', 'Science Fiction'] }).map((b) => b.title)).toEqual(['Aadujeevitham', 'Dune'])
    expect(applyFilters(books, { ...DEFAULT_FILTERS, languages: ['Malayalam'] })).toHaveLength(1)
  })

  it('sorts by title, author and rating in either direction', () => {
    expect(applyFilters(books, { ...DEFAULT_FILTERS, sort: 'title', direction: 'asc' }).map((b) => b.title)).toEqual(['Aadujeevitham', 'Beloved', 'Dune'])
    expect(applyFilters(books, { ...DEFAULT_FILTERS, sort: 'author', direction: 'desc' }).map((b) => b.author)).toEqual(['Toni Morrison', 'Frank Herbert', 'Benyamin'])
    expect(applyFilters(books, { ...DEFAULT_FILTERS, sort: 'rating', direction: 'desc' }).map((b) => b.rating)).toEqual([5, 4, null])
  })

  it('does not mutate the input', () => {
    const copy = [...books]
    applyFilters(books, { ...DEFAULT_FILTERS, sort: 'title', direction: 'asc' })
    expect(books).toEqual(copy)
  })
})

describe('isFiltered', () => {
  it('ignores sort but notices any narrowing', () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false)
    expect(isFiltered({ ...DEFAULT_FILTERS, sort: 'title', direction: 'asc' })).toBe(false)
    expect(isFiltered({ ...DEFAULT_FILTERS, genres: ['Fiction'] })).toBe(true)
    expect(isFiltered({ ...DEFAULT_FILTERS, query: 'x' })).toBe(true)
  })
})

describe('distinctValues', () => {
  it('counts and sorts distinct values, skipping blanks', () => {
    expect(distinctValues(books, 'language')).toEqual([
      { value: 'English', count: 2 },
      { value: 'Malayalam', count: 1 },
    ])
    expect(distinctValues([book({ genre: '' })], 'genre')).toEqual([])
  })
})
