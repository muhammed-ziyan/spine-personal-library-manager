/**
 * Client-side validation for the book form. This only exists to give fast,
 * friendly feedback — the Apps Script backend re-validates every mutation
 * (apps-script/Validation.gs) and is the authority.
 */
import { BOOK_STATUSES, type BookInput } from '@/types'
import { parseIsbn } from './isbn'

export const LIMITS = {
  title: 300,
  author: 300,
  publisher: 300,
  genre: 100,
  subgenre: 100,
  language: 100,
  edition: 100,
  format: 50,
  notes: 5000,
  coverUrl: 1000,
  pagesMax: 50000,
  yearMin: 1000,
} as const

export type FieldErrors = Partial<Record<keyof BookInput, string>>

export function validateBookInput(input: BookInput): FieldErrors {
  const errors: FieldErrors = {}
  const currentYear = new Date().getFullYear()

  if (!input.title.trim()) errors.title = 'Title is required.'
  else if (input.title.length > LIMITS.title) errors.title = `Keep the title under ${LIMITS.title} characters.`

  if (!input.author.trim()) errors.author = 'Author is required.'
  else if (input.author.length > LIMITS.author) errors.author = `Keep the author under ${LIMITS.author} characters.`

  if (input.isbn) {
    const parsed = parseIsbn(input.isbn)
    if (!parsed.valid) errors.isbn = 'That does not look like a valid ISBN-10 or ISBN-13.'
  }

  if (input.genre.length > LIMITS.genre) errors.genre = 'Genre is too long.'
  if (input.subgenre.length > LIMITS.subgenre) errors.subgenre = 'Subgenre is too long.'
  if (input.language.length > LIMITS.language) errors.language = 'Language is too long.'
  if (input.publisher.length > LIMITS.publisher) errors.publisher = 'Publisher is too long.'
  if (input.edition.length > LIMITS.edition) errors.edition = 'Edition is too long.'
  if (input.format.length > LIMITS.format) errors.format = 'Format is too long.'
  if (input.notes.length > LIMITS.notes) errors.notes = `Notes are limited to ${LIMITS.notes} characters.`

  if (!BOOK_STATUSES.includes(input.status)) errors.status = 'Choose a valid status.'

  if (input.rating !== null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
    errors.rating = 'Rating must be between 1 and 5.'
  }

  if (input.publicationYear !== null) {
    const y = input.publicationYear
    if (!Number.isInteger(y) || y < LIMITS.yearMin || y > currentYear + 1) {
      errors.publicationYear = `Enter a year between ${LIMITS.yearMin} and ${currentYear + 1}.`
    }
  }

  if (input.pages !== null) {
    if (!Number.isInteger(input.pages) || input.pages < 1 || input.pages > LIMITS.pagesMax) {
      errors.pages = 'Enter a realistic page count.'
    }
  }

  if (input.coverUrl) {
    if (input.coverUrl.length > LIMITS.coverUrl || !/^https:\/\//i.test(input.coverUrl)) {
      errors.coverUrl = 'Cover must be an https:// link.'
    }
  }

  return errors
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}

export function emptyBookInput(overrides: Partial<BookInput> = {}): BookInput {
  return {
    isbn: '',
    title: '',
    author: '',
    genre: '',
    subgenre: '',
    language: '',
    publisher: '',
    publicationYear: null,
    edition: '',
    pages: null,
    format: '',
    status: 'Unread',
    rating: null,
    notes: '',
    coverUrl: '',
    ...overrides,
  }
}
