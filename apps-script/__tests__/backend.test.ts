import { beforeEach, describe, expect, it } from 'vitest'
import { createBackend, request, sampleBook, TEST_CREDENTIALS, type Backend } from './harness'

interface Genre {
  name: string
  subgenres: string[]
}

let backend: Backend

beforeEach(() => {
  backend = createBackend()
})

function addBook(overrides: Record<string, unknown> = {}) {
  return request(backend, 'addBook', { ...sampleBook, ...overrides })
}

describe('setup', () => {
  it('creates the four tabs with headers and default genres', () => {
    const books = backend.spreadsheet.getSheetByName('Books')!
    expect(books.getRange(1, 1, 1, 3).getValues()[0]).toEqual(['Book ID', 'ISBN', 'Title'])
    expect(backend.spreadsheet.getSheetByName('Settings')).toBeTruthy()
    expect(backend.spreadsheet.getSheetByName('Reading History')).toBeTruthy()
    const genres = request(backend, 'getGenres')
    expect(genres.ok).toBe(true)
    expect((genres.data as Array<{ name: string }>).map((g) => g.name)).toContain('Science Fiction')
    expect((genres.data as Array<{ name: string }>).length).toBe(26)
  })

  it('seeds subgenres alongside each genre', () => {
    const genres = request(backend, 'getGenres').data as Genre[]
    expect(genres.find((g) => g.name === 'Fantasy')?.subgenres).toContain('Epic Fantasy')
    // 'Other' deliberately carries none, and the field falls back to free text.
    expect(genres.find((g) => g.name === 'Other')?.subgenres).toEqual([])
  })

  it('is idempotent', () => {
    addBook()
    backend.setup()
    expect((request(backend, 'getBooks').data as { total: number }).total).toBe(1)
  })

  it('reads a Books sheet written before the Subgenre column existed', () => {
    const id = (addBook().data as { id: string }).id
    const books = backend.spreadsheet.getSheetByName('Books')!
    // Rewind to the old 19-column layout: header and row both lose the last cell.
    books.rows = books.rows.map((row) => row.slice(0, 19))

    backend.setup()

    const book = request(backend, 'getBook', { id }).data as Record<string, unknown>
    expect(book.subgenre).toBe('')
    // Nothing shifted: the columns before it still line up.
    expect(book.title).toBe(sampleBook.title)
    expect(book.updatedAt).toBeTruthy()

    // And the column is writable from here on.
    const updated = request(backend, 'updateBook', { id, patch: { subgenre: 'Habits' } })
    expect((updated.data as Record<string, unknown>).subgenre).toBe('Habits')
    expect((updated.data as Record<string, unknown>).coverUrl).toBe('')
  })

  it('backfills subgenres for a library created before the column existed', () => {
    const sheet = backend.spreadsheet.getSheetByName('Genres')!
    // Rewind to the old one-column layout, with one list the reader curated.
    sheet.rows = [['Genre'], ['Fantasy'], ['Mystery'], ['Shelf of my own'], ['Horror']]
    sheet.getRange(3, 2).setValue('Only mine')

    backend.setup()

    const byName = new Map((request(backend, 'getGenres').data as Genre[]).map((g) => [g.name, g.subgenres]))
    expect(sheet.getRange(1, 1, 1, 2).getValues()[0]).toEqual(['Genre', 'Subgenres'])
    expect(byName.get('Fantasy')).toContain('Epic Fantasy')
    // A hand-edited cell is never overwritten, and an invented genre is left alone.
    expect(byName.get('Mystery')).toEqual(['Only mine'])
    expect(byName.get('Shelf of my own')).toEqual([])

    // Still idempotent: a second run changes nothing.
    const before = JSON.stringify(sheet.rows)
    backend.setup()
    expect(JSON.stringify(sheet.rows)).toBe(before)
  })
})

describe('access control', () => {
  it('refuses every action but login without a token', () => {
    const res = backend.handle({ action: 'getBooks', payload: {} })
    expect(res.ok).toBe(false)
    expect(res.error?.code).toBe('UNAUTHORIZED')
  })

  it('serves requests carrying a valid token', () => {
    expect(request(backend, 'getBooks').ok).toBe(true)
  })

  it('answers ping with the library name and size', () => {
    addBook()
    const res = request(backend, 'ping')
    expect(res.ok).toBe(true)
    expect(res.data).toEqual({ version: '1.0.0', library: 'Spine Test', books: 1 })
  })

  it('checks the token before validating the action payload', () => {
    // A bad payload from an unauthorised caller must not leak validation details.
    const res = backend.handle({ action: 'addBook', payload: { title: '' } })
    expect(res.error?.code).toBe('UNAUTHORIZED')
    expect(res.error?.details).toBeUndefined()
  })

  it('rejects non-string, empty and oversized tokens', () => {
    expect(backend.handle({ action: 'getBooks', payload: {}, token: 12345 }).error?.code).toBe('UNAUTHORIZED')
    expect(request(backend, 'getBooks', {}, '').error?.code).toBe('UNAUTHORIZED')
    expect(request(backend, 'getBooks', {}, 't'.repeat(600)).error?.code).toBe('UNAUTHORIZED')
  })

  it('enforces a per-deployment rate limit', () => {
    let last
    for (let i = 0; i < 125; i++) last = request(backend, 'getStats')
    expect(last?.error?.code).toBe('RATE_LIMITED')
  })
})

describe('sign-in', () => {
  const { username, password } = TEST_CREDENTIALS

  function login(payload: unknown) {
    return backend.handle({ action: 'login', payload })
  }

  it('exchanges the right credentials for a token and a library summary', () => {
    const res = login({ username, password })
    expect(res.ok).toBe(true)
    const data = res.data as { token: string; expiresAt: number; username: string; library: string; books: number }
    expect(data.username).toBe(username)
    expect(data.library).toBe('Spine Test')
    expect(data.books).toBe(0)
    expect(data.expiresAt).toBeGreaterThan(Date.now())
    expect(request(backend, 'getBooks', {}, data.token).ok).toBe(true)
  })

  it('never echoes the password back', () => {
    expect(JSON.stringify(login({ username, password }))).not.toContain(password)
  })

  it('ignores the case of the username but not of the password', () => {
    expect(login({ username: username.toUpperCase(), password }).ok).toBe(true)
    expect(login({ username, password: password.toUpperCase() }).error?.code).toBe('UNAUTHORIZED')
  })

  it('trims surrounding whitespace from the username only', () => {
    expect(login({ username: '  ' + username + '  ', password }).ok).toBe(true)
    expect(login({ username, password: ' ' + password }).error?.code).toBe('UNAUTHORIZED')
  })

  it('rejects a wrong password, a wrong user and missing or non-string fields', () => {
    expect(login({ username, password: 'nope' }).error?.code).toBe('UNAUTHORIZED')
    expect(login({ username, password: password.slice(0, -1) }).error?.code).toBe('UNAUTHORIZED')
    expect(login({ username: 'someone@else.test', password }).error?.code).toBe('UNAUTHORIZED')
    expect(login({}).error?.code).toBe('UNAUTHORIZED')
    expect(login({ username: 12, password: 34 }).error?.code).toBe('UNAUTHORIZED')
    expect(login({ username, password: 'x'.repeat(500) }).error?.code).toBe('UNAUTHORIZED')
  })

  it('gives the same message whichever half was wrong', () => {
    const badUser = login({ username: 'someone@else.test', password }).error?.message
    const badPass = login({ username, password: 'nope' }).error?.message
    expect(badUser).toBe(badPass)
  })

  it('locks out after repeated failures, for the right credentials too', () => {
    for (let i = 0; i < 8; i++) expect(login({ username, password: 'nope' }).error?.code).toBe('UNAUTHORIZED')
    expect(login({ username, password: 'nope' }).error?.code).toBe('RATE_LIMITED')
    expect(login({ username, password }).error?.code).toBe('RATE_LIMITED')
  })

  it('forgets earlier failures once a sign-in succeeds', () => {
    for (let i = 0; i < 4; i++) login({ username, password: 'nope' })
    expect(login({ username, password }).ok).toBe(true)
    for (let i = 0; i < 7; i++) expect(login({ username, password: 'nope' }).error?.code).toBe('UNAUTHORIZED')
  })

  it('refuses everything, sign-in included, until credentials are configured', () => {
    const fresh = createBackend({ unconfigured: true })
    expect(fresh.handle({ action: 'login', payload: { username, password } }).error?.code).toBe('NOT_CONFIGURED')
    expect(fresh.handle({ action: 'getBooks', payload: {} }).error?.code).toBe('NOT_CONFIGURED')
  })
})

describe('session tokens', () => {
  it('rejects a token tampered with in any field', () => {
    const token = backend.token
    const parts = token.split('|')
    const [version, user, issued, expires, signature] = parts
    const forged = [
      ['x1', user, issued, expires, signature],
      [version, encodeURIComponent('someone@else.test'), issued, expires, signature],
      [version, user, issued, String(Number(expires) + 60000), signature],
      [version, user, issued, expires, signature.slice(0, -1) + (signature.endsWith('0') ? '1' : '0')],
    ].map((p) => p.join('|'))
    for (const bad of forged) expect(request(backend, 'getBooks', {}, bad).error?.code).toBe('UNAUTHORIZED')
    expect(request(backend, 'getBooks', {}, token + '|extra').error?.code).toBe('UNAUTHORIZED')
    // The untouched token still works, so the rejections above are about the tampering.
    expect(request(backend, 'getBooks', {}, token).ok).toBe(true)
  })

  it('rejects an expired token that is otherwise correctly signed', () => {
    const [version, user, issued] = backend.token.split('|')
    const stale = [version, user, issued, String(Date.now() - 1000)].join('|')
    const signature = (backend.ctx.hmacHex_ as (v: string) => string)(stale)
    expect(request(backend, 'getBooks', {}, stale + '|' + signature).error?.code).toBe('UNAUTHORIZED')
  })

  it('is invalidated by a password change', () => {
    expect(request(backend, 'getBooks').ok).toBe(true)
    backend.props.set('AUTH_PASSWORD', 'a-completely-different-password')
    expect(request(backend, 'getBooks').error?.code).toBe('UNAUTHORIZED')
  })

  it('is invalidated by a username change', () => {
    backend.props.set('AUTH_USERNAME', 'someone@else.test')
    expect(request(backend, 'getBooks').error?.code).toBe('UNAUTHORIZED')
  })

  it('is invalidated by rotating the signing secret', () => {
    backend.props.delete('AUTH_SECRET')
    expect(request(backend, 'getBooks').error?.code).toBe('UNAUTHORIZED')
  })

  it('is not accepted by a different deployment', () => {
    const other = createBackend()
    expect(request(other, 'getBooks', {}, backend.token).error?.code).toBe('UNAUTHORIZED')
  })
})

describe('malformed requests', () => {
  it('rejects empty, non-JSON and non-object bodies', () => {
    expect(backend.handle('').error?.code).toBe('BAD_REQUEST')
    expect(backend.handle('{not json').error?.code).toBe('BAD_REQUEST')
    expect(backend.handle('[1,2,3]').error?.code).toBe('BAD_REQUEST')
  })

  it('rejects unknown actions', () => {
    const res = backend.handle({ action: 'dropAllTables', payload: {} })
    expect(res.error?.code).toBe('BAD_REQUEST')
  })

  it('rejects prototype-ish action names', () => {
    expect(backend.handle({ action: 'constructor', payload: {} }).error?.code).toBe('BAD_REQUEST')
    expect(backend.handle({ action: '__proto__', payload: {} }).error?.code).toBe('BAD_REQUEST')
  })

  it('rejects oversized bodies', () => {
    const huge = JSON.stringify({ action: 'getBooks', payload: { pad: 'x'.repeat(70_000) } })
    expect(backend.handle(huge).error?.code).toBe('BAD_REQUEST')
  })

  it('rejects non-object payloads', () => {
    expect(request(backend, 'getBooks', 'nope').error?.code).toBe('BAD_REQUEST')
  })
})

describe('addBook validation', () => {
  it('accepts a valid book and applies defaults', () => {
    const res = addBook({ status: undefined, rating: undefined })
    expect(res.ok).toBe(true)
    const book = res.data as Record<string, unknown>
    expect(book.id).toBe('BK-00001')
    expect(book.isbn).toBe('9780735211292')
    expect(book.status).toBe('Unread')
    expect(book.rating).toBeNull()
    expect(typeof book.dateAdded).toBe('string')
    expect(book.dateAdded).toBe(book.updatedAt)
  })

  it('stores, returns and updates the subgenre', () => {
    const id = (addBook().data as { id: string }).id
    expect((request(backend, 'getBook', { id }).data as Record<string, unknown>).subgenre).toBe('Habits')

    const updated = request(backend, 'updateBook', { id, patch: { subgenre: 'Productivity' } })
    expect(updated.ok).toBe(true)
    expect((updated.data as Record<string, unknown>).subgenre).toBe('Productivity')
    // The whole row still lines up after the appended column.
    expect((updated.data as Record<string, unknown>).title).toBe(sampleBook.title)

    // Free text is accepted: the sheet's list is a suggestion, not a constraint.
    const custom = request(backend, 'updateBook', { id, patch: { subgenre: 'Weird Fiction' } })
    expect((custom.data as Record<string, unknown>).subgenre).toBe('Weird Fiction')

    const tooLong = request(backend, 'updateBook', { id, patch: { subgenre: 'x'.repeat(101) } })
    expect(tooLong.ok).toBe(false)
    expect(tooLong.error?.details?.subgenre).toBeDefined()
  })

  it('requires a title', () => {
    const res = addBook({ title: '   ' })
    expect(res.error?.code).toBe('VALIDATION')
    expect(res.error?.details?.title).toBeDefined()
  })

  it('requires an author', () => {
    const res = addBook({ author: '' })
    expect(res.error?.code).toBe('VALIDATION')
    expect(res.error?.details?.author).toBeDefined()
  })

  it('rejects an invalid rating', () => {
    expect(addBook({ rating: 6 }).error?.details?.rating).toBeDefined()
    expect(addBook({ rating: 0 }).error?.details?.rating).toBeDefined()
    expect(addBook({ rating: 2.5 }).error?.details?.rating).toBeDefined()
    expect(addBook({ rating: 'five' }).error?.details?.rating).toBeDefined()
  })

  it('rejects an invalid status', () => {
    expect(addBook({ status: 'Finished' }).error?.details?.status).toBeDefined()
  })

  it('rejects oversized notes and titles', () => {
    expect(addBook({ notes: 'n'.repeat(5001) }).error?.details?.notes).toBeDefined()
    expect(addBook({ title: 't'.repeat(301) }).error?.details?.title).toBeDefined()
  })

  it('rejects an invalid ISBN but allows a missing one', () => {
    expect(addBook({ isbn: '1234567890123' }).error?.details?.isbn).toBeDefined()
    const res = addBook({ isbn: '' })
    expect(res.ok).toBe(true)
    expect((res.data as { isbn: string }).isbn).toBe('')
  })

  it('normalises ISBN-10 to ISBN-13 for storage', () => {
    const res = addBook({ isbn: '0-7352-1129-9' })
    expect((res.data as { isbn: string }).isbn).toBe('9780735211292')
  })

  it('rejects wrong types and out-of-range numbers', () => {
    expect(addBook({ title: { $ne: '' } }).error?.details?.title).toBeDefined()
    expect(addBook({ pages: -4 }).error?.details?.pages).toBeDefined()
    expect(addBook({ publicationYear: 3000 }).error?.details?.publicationYear).toBeDefined()
    expect(addBook({ coverUrl: 'http://insecure.example/cover.jpg' }).error?.details?.coverUrl).toBeDefined()
  })

  it('ignores server-owned fields supplied by the client', () => {
    const res = addBook({ id: 'BK-99999', dateAdded: '1999-01-01T00:00:00.000Z' })
    const book = res.data as { id: string; dateAdded: string }
    expect(book.id).toBe('BK-00001')
    expect(book.dateAdded).not.toBe('1999-01-01T00:00:00.000Z')
  })
})

describe('formula injection', () => {
  it('never writes a formula into the sheet and round-trips the text', () => {
    const hostile = { title: '=HYPERLINK("https://evil.example","click")', author: '+1+1', notes: '-SUM(A1:A9)\n@import', publisher: "'Salem's Lot Press" }
    const res = addBook(hostile)
    expect(res.ok).toBe(true)
    const stored = request(backend, 'getBook', { id: 'BK-00001' }).data as Record<string, string>
    expect(stored.title).toBe(hostile.title)
    expect(stored.author).toBe(hostile.author)
    expect(stored.notes).toBe(hostile.notes)
    expect(stored.publisher).toBe(hostile.publisher)
  })

  it('strips control characters from single-line fields', () => {
    const res = addBook({ title: 'Dune ', author: 'Frank\tHerbert' })
    const book = res.data as { title: string; author: string }
    expect(book.title).toBe('Dune')
    expect(book.author).toBe('Frank Herbert')
  })
})

describe('duplicate detection', () => {
  it('returns DUPLICATE with the existing copies for an existing ISBN', () => {
    addBook()
    const res = addBook({ format: 'Paperback' })
    expect(res.ok).toBe(false)
    expect(res.error?.code).toBe('DUPLICATE')
    const dup = res.error?.details?.duplicate as { title: string; copies: Array<{ id: string }> }
    expect(dup.title).toBe('Atomic Habits')
    expect(dup.copies.map((c) => c.id)).toEqual(['BK-00001'])
    expect((request(backend, 'getBooks').data as { total: number }).total).toBe(1)
  })

  it('creates a record for a new ISBN', () => {
    addBook()
    const res = addBook({ isbn: '9780141036144', title: '1984', author: 'George Orwell' })
    expect(res.ok).toBe(true)
    expect((res.data as { id: string }).id).toBe('BK-00002')
  })

  it('adds another physical copy when the user confirms', () => {
    addBook()
    const res = addBook({ format: 'Paperback', allowDuplicate: true })
    expect(res.ok).toBe(true)
    expect((res.data as { id: string }).id).toBe('BK-00002')
    const check = request(backend, 'checkIsbn', { isbn: '978-0-7352-1129-2' }).data as { duplicate: { copies: unknown[] } }
    expect(check.duplicate.copies).toHaveLength(2)
  })

  it('treats ISBN-10 and ISBN-13 of the same edition as duplicates', () => {
    addBook({ isbn: '9780735211292' })
    expect(addBook({ isbn: '0735211299' }).error?.code).toBe('DUPLICATE')
  })

  it('never flags books without an ISBN as duplicates', () => {
    addBook({ isbn: '' })
    expect(addBook({ isbn: '' }).ok).toBe(true)
  })

  it('checkIsbn reports no duplicate for a new ISBN and validates input', () => {
    const fresh = request(backend, 'checkIsbn', { isbn: '9780141036144' }).data as { isbn: string; duplicate: null }
    expect(fresh).toEqual({ isbn: '9780141036144', duplicate: null })
    expect(request(backend, 'checkIsbn', { isbn: 'abc' }).error?.code).toBe('VALIDATION')
  })

  it('runs the duplicate check and insert under the script lock', () => {
    addBook()
    expect(backend.lock.acquired).toBe(1)
    expect(backend.lock.released).toBe(1)
    backend.lock.failNext = true
    expect(addBook({ isbn: '9780141036144' }).error?.code).toBe('CONFLICT')
  })
})

describe('Book ID generation', () => {
  it('is sequential', () => {
    const ids = [addBook({ isbn: '' }), addBook({ isbn: '' }), addBook({ isbn: '' })].map((r) => (r.data as { id: string }).id)
    expect(ids).toEqual(['BK-00001', 'BK-00002', 'BK-00003'])
  })

  it('never reuses an ID after a deletion', () => {
    addBook({ isbn: '' })
    addBook({ isbn: '' })
    expect(request(backend, 'deleteBook', { id: 'BK-00002' }).ok).toBe(true)
    const next = addBook({ isbn: '' })
    expect((next.data as { id: string }).id).toBe('BK-00003')
  })

  it('never reuses an ID even if the whole library is deleted', () => {
    addBook({ isbn: '' })
    request(backend, 'deleteBook', { id: 'BK-00001' })
    expect((addBook({ isbn: '' }).data as { id: string }).id).toBe('BK-00002')
  })

  it('self-heals when the counter property is lost', () => {
    addBook({ isbn: '' })
    addBook({ isbn: '' })
    backend.props.delete('BOOK_ID_COUNTER')
    expect((addBook({ isbn: '' }).data as { id: string }).id).toBe('BK-00003')
  })

  it('does not derive IDs from the row count', () => {
    addBook({ isbn: '' })
    addBook({ isbn: '' })
    addBook({ isbn: '' })
    request(backend, 'deleteBook', { id: 'BK-00001' })
    request(backend, 'deleteBook', { id: 'BK-00002' })
    // 1 row left; a naive rows+1 scheme would produce BK-00002 (a collision with history).
    expect((addBook({ isbn: '' }).data as { id: string }).id).toBe('BK-00004')
  })

  it('mirrors the counter into the Settings sheet', () => {
    addBook({ isbn: '' })
    const settings = backend.spreadsheet.getSheetByName('Settings')!
    const rows = settings.getRange(2, 1, settings.getLastRow() - 1, 2).getValues()
    expect(rows).toContainEqual(['bookIdCounter', '1'])
  })
})

describe('read, update, delete and status', () => {
  it('getBook returns the record and 404s for missing IDs', () => {
    addBook()
    expect((request(backend, 'getBook', { id: 'BK-00001' }).data as { title: string }).title).toBe('Atomic Habits')
    expect(request(backend, 'getBook', { id: 'BK-00042' }).error?.code).toBe('NOT_FOUND')
    expect(request(backend, 'getBook', { id: '1' }).error?.code).toBe('BAD_REQUEST')
    expect(request(backend, 'getBook', { id: { $gt: '' } }).error?.code).toBe('BAD_REQUEST')
  })

  it('updateBook validates the ID and the supplied fields only', () => {
    addBook()
    const ok = request(backend, 'updateBook', { id: 'BK-00001', patch: { rating: 5, notes: 'Loved it' } })
    expect(ok.ok).toBe(true)
    expect((ok.data as { rating: number; title: string }).rating).toBe(5)
    expect((ok.data as { rating: number; title: string }).title).toBe('Atomic Habits')

    expect(request(backend, 'updateBook', { id: 'BK-00001', patch: { rating: 9 } }).error?.code).toBe('VALIDATION')
    expect(request(backend, 'updateBook', { id: 'BK-00001', patch: { id: 'BK-00009' } }).error?.code).toBe('VALIDATION')
    expect(request(backend, 'updateBook', { id: 'BK-00001', patch: { dateAdded: 'x' } }).error?.code).toBe('VALIDATION')
    expect(request(backend, 'updateBook', { id: 'BK-00001', patch: {} }).error?.code).toBe('VALIDATION')
    expect(request(backend, 'updateBook', { id: 'nope', patch: { rating: 1 } }).error?.code).toBe('BAD_REQUEST')
    expect(request(backend, 'updateBook', { id: 'BK-00077', patch: { rating: 1 } }).error?.code).toBe('NOT_FOUND')
  })

  it('updateBook bumps updatedAt and keeps dateAdded', () => {
    const created = addBook().data as { dateAdded: string; updatedAt: string }
    const updated = request(backend, 'updateBook', { id: 'BK-00001', patch: { title: 'Atomic Habits (2nd)' } }).data as { dateAdded: string; updatedAt: string }
    expect(updated.dateAdded).toBe(created.dateAdded)
    expect(updated.updatedAt >= created.updatedAt).toBe(true)
  })

  it('changeStatus updates the book, dates and reading history', () => {
    addBook()
    const reading = request(backend, 'changeStatus', { id: 'BK-00001', status: 'Reading' }).data as Record<string, unknown>
    expect(reading.status).toBe('Reading')
    expect(reading.dateStarted).toBeTruthy()
    expect(reading.dateFinished).toBeNull()

    const read = request(backend, 'changeStatus', { id: 'BK-00001', status: 'Read' }).data as Record<string, unknown>
    expect(read.dateFinished).toBeTruthy()

    const history = backend.spreadsheet.getSheetByName('Reading History')!
    const rows = history.getRange(2, 1, history.getLastRow() - 1, 3).getValues()
    expect(rows).toEqual([
      ['BK-00001', 'Unread', 'Reading'],
      ['BK-00001', 'Reading', 'Read'],
    ])

    expect(request(backend, 'changeStatus', { id: 'BK-00001', status: 'Done' }).error?.code).toBe('VALIDATION')
  })

  it('deleteBook removes only that copy and validates the ID', () => {
    addBook()
    addBook({ allowDuplicate: true, format: 'Paperback' })
    expect(request(backend, 'deleteBook', { id: 'BK-00001' }).ok).toBe(true)
    const remaining = (request(backend, 'getBooks').data as { books: Array<{ id: string }> }).books
    expect(remaining.map((b) => b.id)).toEqual(['BK-00002'])
    expect(request(backend, 'deleteBook', { id: 'BK-00001' }).error?.code).toBe('NOT_FOUND')
    expect(request(backend, 'deleteBook', { id: '' }).error?.code).toBe('BAD_REQUEST')
  })
})

describe('getBooks, search and stats', () => {
  beforeEach(() => {
    addBook({ status: 'Read', rating: 5 })
    addBook({ isbn: '9780141036144', title: '1984', author: 'George Orwell', genre: 'Fiction', status: 'Reading', rating: 4 })
    addBook({ isbn: '', title: 'Untitled Zine', author: 'Anon', genre: '', language: 'Malayalam', status: 'Unread' })
  })

  it('filters by status, genre, language and free-text query', () => {
    const byStatus = request(backend, 'getBooks', { status: 'Reading' }).data as { books: Array<{ title: string }> }
    expect(byStatus.books.map((b) => b.title)).toEqual(['1984'])
    const byGenre = request(backend, 'getBooks', { genre: 'Fiction' }).data as { total: number }
    expect(byGenre.total).toBe(1)
    const byLanguage = request(backend, 'getBooks', { language: 'Malayalam' }).data as { total: number }
    expect(byLanguage.total).toBe(1)
    const byAuthor = request(backend, 'searchBooks', { query: 'orwell' }).data as Array<{ title: string }>
    expect(byAuthor.map((b) => b.title)).toEqual(['1984'])
    const byIsbn = request(backend, 'searchBooks', { query: '978-0-7352' }).data as Array<{ title: string }>
    expect(byIsbn.map((b) => b.title)).toEqual(['Atomic Habits'])
  })

  it('sorts and paginates', () => {
    const titles = (request(backend, 'getBooks', { sort: 'title' }).data as { books: Array<{ title: string }> }).books.map((b) => b.title)
    expect(titles).toEqual(['1984', 'Atomic Habits', 'Untitled Zine'])
    const rating = (request(backend, 'getBooks', { sort: 'rating' }).data as { books: Array<{ title: string }> }).books.map((b) => b.title)
    expect(rating[0]).toBe('Atomic Habits')
    const page = request(backend, 'getBooks', { sort: 'title', limit: 1, offset: 1 }).data as { books: Array<{ title: string }>; total: number }
    expect(page.books.map((b) => b.title)).toEqual(['Atomic Habits'])
    expect(page.total).toBe(3)
  })

  it('ignores unsafe or unknown query params', () => {
    const res = request(backend, 'getBooks', { sort: 'DROP TABLE', status: 'Nope', limit: 999999 })
    expect(res.ok).toBe(true)
    expect((res.data as { total: number }).total).toBe(3)
  })

  it('computes stats from real rows', () => {
    const stats = request(backend, 'getStats').data as Record<string, unknown>
    expect(stats.total).toBe(3)
    expect(stats.byStatus).toEqual({ Unread: 1, Reading: 1, Read: 1, 'On Hold': 0, Abandoned: 0 })
    expect(stats.byGenre).toEqual({ 'Self Help': 1, Fiction: 1 })
    expect(stats.byLanguage).toEqual({ English: 2, Malayalam: 1 })
    expect(stats.rated).toBe(2)
    expect(stats.averageRating).toBe(4.5)
  })

  it('returns empty stats for an empty library', () => {
    const empty = createBackend()
    const stats = request(empty, 'getStats').data as { total: number; averageRating: number | null }
    expect(stats.total).toBe(0)
    expect(stats.averageRating).toBeNull()
    expect((request(empty, 'getBooks').data as { books: unknown[] }).books).toEqual([])
  })
})

describe('error hygiene', () => {
  it('never leaks internal exceptions', () => {
    // Simulate a backend failure by removing the Books sheet after setup.
    backend.spreadsheet.sheets.delete('Books')
    const res = request(backend, 'getBooks')
    expect(res.ok).toBe(false)
    expect(res.error?.code).toBe('SERVER_ERROR')
    expect(res.error?.message).toBe('Something went wrong. Please try again.')
    expect(JSON.stringify(res)).not.toMatch(/Missing sheet|setupSpreadsheet/)
  })
})
