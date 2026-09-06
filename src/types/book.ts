/**
 * Shared data contracts between the Spine frontend and the Apps Script backend.
 * The backend serialises records to exactly these shapes (see apps-script/Schema.gs).
 */

export const BOOK_STATUSES = ['Unread', 'Reading', 'Read', 'On Hold', 'Abandoned'] as const
export type BookStatus = (typeof BOOK_STATUSES)[number]

export const BOOK_FORMATS = ['Paperback', 'Hardcover', 'Mass Market', 'Trade Paperback', 'Boxed Set', 'Other'] as const
export type BookFormat = (typeof BOOK_FORMATS)[number]

/** 1–5 stars, or null when the book has not been rated. */
export type Rating = 1 | 2 | 3 | 4 | 5 | null

export interface Book {
  /** Immutable, server-generated physical-copy identifier, e.g. `BK-00021`. */
  id: string
  /** Normalised ISBN-10/13 digits only, or empty string when the copy has no ISBN. */
  isbn: string
  title: string
  author: string
  genre: string
  language: string
  publisher: string
  publicationYear: number | null
  edition: string
  pages: number | null
  format: string
  status: BookStatus
  rating: Rating
  /** ISO-8601 timestamps generated server-side. */
  dateAdded: string
  dateStarted: string | null
  dateFinished: string | null
  notes: string
  coverUrl: string
  updatedAt: string
}

/** Fields the client is allowed to send when creating or editing a copy. */
export type BookInput = Omit<Book, 'id' | 'dateAdded' | 'updatedAt' | 'dateStarted' | 'dateFinished'>

export type BookPatch = Partial<BookInput>

export interface Genre {
  name: string
}

export interface ReadingHistoryEntry {
  bookId: string
  previousStatus: BookStatus | ''
  newStatus: BookStatus
  changedAt: string
}

export interface LibraryStats {
  total: number
  byStatus: Record<BookStatus, number>
  byGenre: Record<string, number>
  byLanguage: Record<string, number>
  rated: number
  averageRating: number | null
}

export const EMPTY_STATS: LibraryStats = {
  total: 0,
  byStatus: { Unread: 0, Reading: 0, Read: 0, 'On Hold': 0, Abandoned: 0 },
  byGenre: {},
  byLanguage: {},
  rated: 0,
  averageRating: null,
}

export function isBookStatus(value: unknown): value is BookStatus {
  return typeof value === 'string' && (BOOK_STATUSES as readonly string[]).includes(value)
}
