/**
 * ISBN helpers. Mirrors apps-script/Isbn.gs — keep both in sync.
 *
 * Normalised form: digits only (plus a trailing `X` for ISBN-10 check digits),
 * upper-cased, with all hyphens, spaces and other formatting removed.
 */

export interface IsbnResult {
  /** Normalised ISBN string, or `''` when the input was empty. */
  isbn: string
  /** `true` when the ISBN passed checksum validation. */
  valid: boolean
  kind: 'isbn10' | 'isbn13' | 'empty' | 'invalid'
}

/** Strip formatting from an ISBN-ish string without validating it. */
export function normalizeIsbn(raw: string | null | undefined): string {
  if (!raw) return ''
  return String(raw)
    .toUpperCase()
    .replace(/^ISBN(?:-1[03])?:?\s*/i, '')
    .replace(/[^0-9X]/g, '')
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const ch = isbn[i]
    const value = ch === 'X' ? 10 : Number(ch)
    sum += value * (10 - i)
  }
  return sum % 11 === 0
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return check === Number(isbn[12])
}

/** Parse arbitrary user or scanner input into a normalised, validated ISBN. */
export function parseIsbn(raw: string | null | undefined): IsbnResult {
  const isbn = normalizeIsbn(raw)
  if (!isbn) {
    // Blank input is "no ISBN"; non-blank input with no ISBN characters is a bad ISBN.
    const blank = !raw || String(raw).trim() === ''
    return { isbn: '', valid: false, kind: blank ? 'empty' : 'invalid' }
  }
  if (isbn.length === 13 && isValidIsbn13(isbn)) return { isbn, valid: true, kind: 'isbn13' }
  if (isbn.length === 10 && isValidIsbn10(isbn)) return { isbn, valid: true, kind: 'isbn10' }
  return { isbn, valid: false, kind: 'invalid' }
}

/** Convert a valid ISBN-10 to its ISBN-13 (978-prefixed) equivalent. */
export function isbn10To13(isbn10: string): string {
  const core = '978' + isbn10.slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
  return core + String((10 - (sum % 10)) % 10)
}

/**
 * EAN barcodes on books are ISBN-13s in the 978/979 "Bookland" ranges.
 * Other EAN-13s (e.g. groceries) are not books.
 */
export function isBooklandEan(code: string): boolean {
  return /^(978|979)\d{10}$/.test(code)
}

/** Pretty-print an ISBN with hyphens for display only. */
export function formatIsbn(isbn: string): string {
  if (isbn.length === 13) {
    return `${isbn.slice(0, 3)}-${isbn.slice(3, 4)}-${isbn.slice(4, 9)}-${isbn.slice(9, 12)}-${isbn.slice(12)}`
  }
  if (isbn.length === 10) {
    return `${isbn.slice(0, 1)}-${isbn.slice(1, 5)}-${isbn.slice(5, 9)}-${isbn.slice(9)}`
  }
  return isbn
}
