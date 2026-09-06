import type { Book } from '@/types'

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

/** "March 2026" — used for "Collecting since …". */
export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
}

export function monthName(index: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, index, 1))
}

/** "just now", "2 min ago", "3 hr ago", "yesterday", "4 days ago". */
export function relativeTime(timestamp: number | null | undefined, now = Date.now()): string {
  if (!timestamp) return 'not yet'
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return formatDate(new Date(timestamp).toISOString())
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Two-letter monogram, kept for places that need a very small placeholder. */
export function initials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Deterministic hue from a string so placeholder covers vary pleasantly. */
export function hueFrom(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return Math.abs(hash) % 360
}

/** The five cover tints from the mockup, cycled deterministically per book. */
const COVER_PALETTES: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: 'var(--color-accent-700)', fg: 'var(--color-accent-100)' },
  { bg: 'var(--color-accent-2-700)', fg: 'var(--color-accent-2-100)' },
  { bg: 'var(--color-accent-300)', fg: 'var(--color-accent-900)' },
  { bg: 'var(--color-accent-2-300)', fg: 'var(--color-accent-2-900)' },
  { bg: 'var(--color-neutral-800)', fg: 'var(--color-neutral-100)' },
]

export function coverPalette(text: string): { bg: string; fg: string } {
  return COVER_PALETTES[hueFrom(text) % COVER_PALETTES.length]
}

const CSV_COLUMNS: Array<[keyof Book, string]> = [
  ['id', 'ID'],
  ['isbn', 'ISBN'],
  ['title', 'Title'],
  ['author', 'Author'],
  ['genre', 'Genre'],
  ['language', 'Language'],
  ['publisher', 'Publisher'],
  ['publicationYear', 'Year'],
  ['edition', 'Edition'],
  ['pages', 'Pages'],
  ['format', 'Format'],
  ['status', 'Status'],
  ['rating', 'Rating'],
  ['dateAdded', 'Date added'],
  ['dateStarted', 'Date started'],
  ['dateFinished', 'Date finished'],
  ['notes', 'Notes'],
  ['coverUrl', 'Cover URL'],
]

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  // Prevent spreadsheet formula injection and quote anything that needs it.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** RFC 4180-style CSV of the whole library, with a BOM so spreadsheets read UTF-8. */
export function booksToCsv(books: Book[]): string {
  const header = CSV_COLUMNS.map(([, label]) => csvCell(label)).join(',')
  const rows = books.map((book) => CSV_COLUMNS.map(([key]) => csvCell(book[key])).join(','))
  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`
}
