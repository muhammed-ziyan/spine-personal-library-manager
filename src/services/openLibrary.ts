/**
 * Open Library metadata lookup.
 *
 * A barcode gives us an ISBN and nothing else. Open Library's read API turns
 * that ISBN into title/author/publisher/cover so the add form arrives mostly
 * filled in — the user still reviews and edits every field before saving.
 *
 * Transport notes:
 *  - Open Library is free, key-less and CORS-enabled, so the browser talks to
 *    it directly rather than proxying through Apps Script. It never sees the
 *    user's identity, their library, or the Apps Script URL.
 *  - Three requests go out in parallel. The two `jscmd`s answer different
 *    halves of the *edition* record — `data` has publisher and author names,
 *    `details` has language, physical format and edition name — and the
 *    edition is what the user is holding, so it always wins. Search is a
 *    work-level backstop for the sparse edition records Open Library is full
 *    of (a bare ISBN with no author linked to it).
 *  - Search only ever fills gaps, and only when its title matches the
 *    edition's: `q=isbn:…` quietly falls back to a fuzzy full-text match, so
 *    an unknown ISBN comes back with a confident, unrelated book attached.
 *  - Every lookup is best effort. A miss, a timeout or an offline device just
 *    means the user types the details in themselves.
 */
import { BOOK_FORMATS, type BookInput, type Genre } from '@/types'
import { isbn13To10, normalizeIsbn } from '@/utils/isbn'
import { LIMITS } from '@/utils/validation'

const API_ORIGIN = 'https://openlibrary.org'
const COVERS_ORIGIN = 'https://covers.openlibrary.org'

export const LOOKUP_TIMEOUT_MS = 8_000

/**
 * Search is the slowest of the three requests and only ever fills gaps, so it
 * is given a shorter leash than the edition record it is backing up.
 */
export const SEARCH_TIMEOUT_MS = 3_000

/** Most-recent lookups kept in memory so the scanner can warm the add form. */
const MAX_CACHE_ENTRIES = 24

export type LookupErrorCode = 'NETWORK' | 'TIMEOUT' | 'SERVER_ERROR' | 'MALFORMED_RESPONSE'

export class LookupError extends Error {
  readonly code: LookupErrorCode

  constructor(code: LookupErrorCode, message: string) {
    super(message)
    this.name = 'LookupError'
    this.code = code
  }
}

export function describeLookupError(error: unknown): string {
  if (error instanceof LookupError && error.code === 'TIMEOUT') {
    return 'Open Library took too long to answer.'
  }
  return "Couldn't reach Open Library."
}

/** A normalised Open Library edition record. Every field is optional in practice. */
export interface BookMetadata {
  /** The ISBN this record was looked up by, normalised. */
  isbn: string
  title: string
  subtitle: string
  authors: string[]
  publisher: string
  publicationYear: number | null
  pages: number | null
  edition: string
  /** Already mapped onto one of `BOOK_FORMATS`, or `''` when unrecognised. */
  format: string
  /** English name of the edition's language, or `''` when unrecognised. */
  language: string
  subjects: string[]
  coverUrl: string
  /** The edition's page on openlibrary.org, for attribution. */
  sourceUrl: string
}

export interface OpenLibraryClient {
  /** Resolves to the edition record, or `null` when Open Library has no entry. */
  lookup(isbn: string): Promise<BookMetadata | null>
  /** Starts (and caches) a lookup without waiting for it. Errors are swallowed. */
  prefetch(isbn: string): void
  clearCache(): void
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Positive integers only — Open Library carries the odd `0` or `"320"`. */
function count(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.trim()) : value
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  const rounded = Math.round(n)
  return rounded > 0 ? rounded : null
}

/** `data` returns `[{ name }]`, `details` returns `['name']`. Accept both. */
function names(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    const name = typeof item === 'string' ? item.trim() : str(asRecord(item)?.name)
    if (name) out.push(name)
  }
  return out
}

/** "October 16, 2018", "2018-10", "1st ed. 1999" → 2018 / 2018 / 1999. */
export function parsePublishYear(raw: unknown, now: Date = new Date()): number | null {
  const match = /\b(\d{4})\b/.exec(str(raw))
  if (!match) return null
  const year = Number(match[1])
  return year >= LIMITS.yearMin && year <= now.getFullYear() + 1 ? year : null
}

const FORMAT_RULES: Array<[RegExp, (typeof BOOK_FORMATS)[number]]> = [
  [/mass[\s-]?market/, 'Mass Market'],
  [/trade/, 'Trade Paperback'],
  [/hard\s?(cover|back|bound)/, 'Hardcover'],
  [/paper\s?back|softcover|soft\s?cover/, 'Paperback'],
  [/box(ed)?[\s-]?set|slipcase/, 'Boxed Set'],
]

/** Map Open Library's free-text `physical_format` onto our fixed list. */
export function mapFormat(raw: unknown): string {
  const value = str(raw).toLowerCase()
  if (!value) return ''
  for (const [pattern, format] of FORMAT_RULES) {
    if (pattern.test(value)) return format
  }
  return ''
}

/** MARC21 codes, as used in `/languages/<code>` keys. */
const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'English',
  mal: 'Malayalam',
  hin: 'Hindi',
  tam: 'Tamil',
  tel: 'Telugu',
  kan: 'Kannada',
  ben: 'Bengali',
  mar: 'Marathi',
  guj: 'Gujarati',
  pan: 'Punjabi',
  urd: 'Urdu',
  san: 'Sanskrit',
  ara: 'Arabic',
  fre: 'French',
  fra: 'French',
  ger: 'German',
  deu: 'German',
  spa: 'Spanish',
  ita: 'Italian',
  por: 'Portuguese',
  dut: 'Dutch',
  nld: 'Dutch',
  rus: 'Russian',
  jpn: 'Japanese',
  chi: 'Chinese',
  zho: 'Chinese',
  kor: 'Korean',
  tur: 'Turkish',
  per: 'Persian',
  fas: 'Persian',
  heb: 'Hebrew',
  swe: 'Swedish',
  dan: 'Danish',
  nor: 'Norwegian',
  fin: 'Finnish',
  pol: 'Polish',
  gre: 'Greek',
  ell: 'Greek',
  ind: 'Indonesian',
  tha: 'Thai',
  vie: 'Vietnamese',
  ukr: 'Ukrainian',
  swa: 'Swahili',
  lat: 'Latin',
}

/** `[{ key: '/languages/eng' }]` → `English`. */
export function mapLanguage(value: unknown): string {
  if (!Array.isArray(value)) return ''
  for (const item of value) {
    const key = typeof item === 'string' ? item : str(asRecord(item)?.key)
    const code = key.split('/').pop()?.toLowerCase() ?? ''
    if (LANGUAGE_NAMES[code]) return LANGUAGE_NAMES[code]
  }
  return ''
}

function coverFromData(record: Record<string, unknown> | null): string {
  const cover = asRecord(record?.cover)
  const url = str(cover?.large) || str(cover?.medium) || str(cover?.small)
  return /^https:\/\//i.test(url) ? url : ''
}

function coverFromDetails(detail: Record<string, unknown> | null): string {
  const covers = detail?.covers
  if (!Array.isArray(covers)) return ''
  const id = count(covers[0])
  return id ? `${COVERS_ORIGIN}/b/id/${id}-L.jpg` : ''
}

/**
 * Open Library indexes many older editions under their ISBN-10 only, so a
 * 978-prefixed scan is asked for under both forms in a single request.
 */
export function isbnCandidates(isbn: string): string[] {
  const normalized = normalizeIsbn(isbn)
  if (!normalized) return []
  const candidates = [normalized]
  const isbn10 = isbn13To10(normalized)
  if (isbn10 && isbn10 !== normalized) candidates.push(isbn10)
  return candidates
}

/** Kept narrow: a search response is otherwise a very large document. */
const SEARCH_FIELDS = ['title', 'author_name', 'subject', 'cover_i', 'language'] as const

/** Pull the first matching candidate's entry out of a `bibkeys` response. */
function pickRecord(body: unknown, candidates: string[]): Record<string, unknown> | null {
  const map = asRecord(body)
  if (!map) return null
  for (const candidate of candidates) {
    const record = asRecord(map[`ISBN:${candidate}`])
    if (record) return record
  }
  return null
}

function coverFromSearch(doc: Record<string, unknown> | null): string {
  const id = count(doc?.cover_i)
  return id ? `${COVERS_ORIGIN}/b/id/${id}-L.jpg` : ''
}

function titleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Open Library hands back `http://` links; nothing we keep should be one. */
function secureUrl(url: string): string {
  return url.replace(/^http:\/\//i, 'https://')
}

function buildMetadata(isbn: string, data: Record<string, unknown> | null, details: Record<string, unknown> | null, search: Record<string, unknown> | null): BookMetadata | null {
  const detail = asRecord(details?.details)
  const title = str(data?.title) || str(detail?.title)
  // No edition title means Open Library has nothing usable for this ISBN, even
  // if it did return a stub record — and a search hit on its own is not
  // trustworthy enough to stand in (see the note at the top of this file).
  if (!title) return null

  // The search result describes the *work*; take it only when it is plainly
  // about the same book, and only for the fields the edition left empty.
  const work = search && titleKey(str(search.title)) === titleKey(title) ? search : null
  // `language` on a work lists every language it was ever published in, so it
  // says nothing about this copy unless there is exactly one.
  const workLanguages = Array.isArray(work?.language) ? work.language : []

  const authors = names(data?.authors)
  const publishers = names(data?.publishers)
  const subjects = names(data?.subjects)

  return {
    isbn,
    title,
    subtitle: str(data?.subtitle) || str(detail?.subtitle),
    authors: authors.length ? authors : names(detail?.authors).length ? names(detail?.authors) : names(work?.author_name),
    publisher: (publishers.length ? publishers : names(detail?.publishers))[0] ?? '',
    publicationYear: parsePublishYear(str(data?.publish_date) || str(detail?.publish_date)),
    pages: count(data?.number_of_pages) ?? count(detail?.number_of_pages),
    edition: str(detail?.edition_name),
    format: mapFormat(detail?.physical_format),
    language: mapLanguage(detail?.languages) || (workLanguages.length === 1 ? mapLanguage(workLanguages) : ''),
    subjects: subjects.length ? subjects : names(detail?.subjects).length ? names(detail?.subjects) : names(work?.subject),
    coverUrl: coverFromData(data) || coverFromDetails(detail) || coverFromSearch(work),
    sourceUrl: secureUrl(str(data?.url) || str(details?.info_url)) || `${API_ORIGIN}/isbn/${isbn}`,
  }
}

// ---------------------------------------------------------------------------
// Turning a record into form values
// ---------------------------------------------------------------------------

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value
}

function normalizeSubject(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Only ever suggest a genre the user already keeps in their Genres sheet —
 * Open Library subjects ("Habit", "Self-actualization (Psychology)") would
 * otherwise pollute a list the user curates by hand.
 */
export function matchGenre(subjects: string[], genres: string[]): string {
  const byName = new Map<string, string>()
  for (const genre of genres) {
    const key = normalizeSubject(genre)
    if (key) byName.set(key, genre)
  }
  if (!byName.size) return ''

  const considered = subjects.slice(0, 25).map(normalizeSubject).filter(Boolean)
  for (const subject of considered) {
    const exact = byName.get(subject)
    if (exact) return exact
  }
  // "Science fiction, American" → "Science Fiction". The longest genre wins, so
  // the more specific shelf beats the broader one.
  let bestKey = ''
  let bestName = ''
  for (const subject of considered) {
    const padded = ` ${subject} `
    for (const [key, name] of byName) {
      if (key.length > bestKey.length && padded.includes(` ${key} `)) {
        bestKey = key
        bestName = name
      }
    }
  }
  return bestName
}

/** The subset of the add form Open Library can answer for. */
export function metadataToInput(metadata: BookMetadata, genres: Array<Genre | string> = []): Partial<BookInput> {
  const genreNames = genres.map((genre) => (typeof genre === 'string' ? genre : genre.name))
  const title = metadata.subtitle ? `${metadata.title}: ${metadata.subtitle}` : metadata.title

  return {
    title: clamp(title, LIMITS.title),
    author: clamp(metadata.authors.slice(0, 3).join(', '), LIMITS.author),
    genre: matchGenre(metadata.subjects, genreNames),
    language: metadata.language,
    publisher: clamp(metadata.publisher, LIMITS.publisher),
    publicationYear: metadata.publicationYear,
    edition: clamp(metadata.edition, LIMITS.edition),
    pages: metadata.pages,
    format: metadata.format,
    coverUrl: metadata.coverUrl.length <= LIMITS.coverUrl ? metadata.coverUrl : '',
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export type LookupFetch = (input: string, init: RequestInit) => Promise<Response>

const defaultFetch: LookupFetch = (input, init) => fetch(input, init)

async function fetchJson(fetchImpl: LookupFetch, url: string, signal: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetchImpl(url, { method: 'GET', signal, redirect: 'follow', credentials: 'omit', referrerPolicy: 'no-referrer' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LookupError('TIMEOUT', 'Open Library took too long to answer.')
    }
    throw new LookupError('NETWORK', "Couldn't reach Open Library.")
  }
  if (response.status >= 500) throw new LookupError('SERVER_ERROR', 'Open Library is temporarily unavailable.')
  // A 4xx means "nothing here", which is a miss rather than a failure.
  if (!response.ok) return null
  try {
    return await response.json()
  } catch {
    throw new LookupError('MALFORMED_RESPONSE', 'Open Library sent an unexpected reply.')
  }
}

/** The single best-matching work from a `search.json` response, if any. */
function firstDoc(body: unknown): Record<string, unknown> | null {
  const docs = asRecord(body)?.docs
  return Array.isArray(docs) ? asRecord(docs[0]) : null
}

function valueOf(result: PromiseSettledResult<unknown>): unknown {
  return result.status === 'fulfilled' ? result.value : null
}

export function createOpenLibraryClient(fetchImpl: LookupFetch = defaultFetch): OpenLibraryClient {
  // Keyed by normalised ISBN. Promises (not values) are cached, so the
  // scanner's prefetch and the add form's lookup share a single request.
  const cache = new Map<string, Promise<BookMetadata | null>>()

  async function request(isbn: string): Promise<BookMetadata | null> {
    const candidates = isbnCandidates(isbn)
    if (!candidates.length) return null

    const query = `bibkeys=${encodeURIComponent(candidates.map((candidate) => `ISBN:${candidate}`).join(','))}&format=json`
    const search = `q=${encodeURIComponent(`isbn:${candidates[0]}`)}&fields=${SEARCH_FIELDS.join(',')}&limit=1`
    const controller = new AbortController()
    const searchController = new AbortController()
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)
    const searchTimer = setTimeout(() => searchController.abort(), SEARCH_TIMEOUT_MS)
    try {
      const [data, details, work] = await Promise.allSettled([
        fetchJson(fetchImpl, `${API_ORIGIN}/api/books?${query}&jscmd=data`, controller.signal),
        fetchJson(fetchImpl, `${API_ORIGIN}/api/books?${query}&jscmd=details`, controller.signal),
        fetchJson(fetchImpl, `${API_ORIGIN}/search.json?${search}`, searchController.signal),
      ])
      // Only losing both edition requests is an error; either half alone still
      // yields a record, and search is optional throughout.
      if (data.status === 'rejected' && details.status === 'rejected') throw data.reason
      return buildMetadata(candidates[0], pickRecord(valueOf(data), candidates), pickRecord(valueOf(details), candidates), firstDoc(valueOf(work)))
    } finally {
      clearTimeout(timer)
      clearTimeout(searchTimer)
    }
  }

  function start(isbn: string): Promise<BookMetadata | null> {
    const key = normalizeIsbn(isbn)
    const cached = cache.get(key)
    if (cached) return cached

    // Failures are not cached: the next attempt should hit the network again.
    const pending = request(key).catch((error: unknown) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, pending)
    if (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next()
      if (!oldest.done) cache.delete(oldest.value)
    }
    return pending
  }

  return {
    lookup: (isbn) => start(isbn),
    prefetch: (isbn) => {
      void start(isbn).catch(() => {})
    },
    clearCache: () => cache.clear(),
  }
}

export const openLibrary: OpenLibraryClient = createOpenLibraryClient()
