import { describe, expect, it, vi } from 'vitest'
import {
  createOpenLibraryClient,
  isbnCandidates,
  mapFormat,
  mapLanguage,
  matchGenre,
  metadataToInput,
  parsePublishYear,
  type LookupFetch,
} from './openLibrary'

const ISBN13 = '9780735211292'
const ISBN10 = '0735211299'

const DATA_RECORD = {
  url: 'https://openlibrary.org/books/OL26211088M/Atomic_Habits',
  key: '/books/OL26211088M',
  title: 'Atomic Habits',
  subtitle: 'An Easy & Proven Way to Build Good Habits',
  authors: [{ url: 'https://openlibrary.org/authors/OL7511250A/James_Clear', name: 'James Clear' }],
  number_of_pages: 319,
  publishers: [{ name: 'Avery' }],
  publish_date: 'October 16, 2018',
  subjects: [{ name: 'Habit' }, { name: 'Self-Help' }],
  cover: {
    small: 'https://covers.openlibrary.org/b/id/8739161-S.jpg',
    medium: 'https://covers.openlibrary.org/b/id/8739161-M.jpg',
    large: 'https://covers.openlibrary.org/b/id/8739161-L.jpg',
  },
}

const DETAILS_RECORD = {
  bib_key: `ISBN:${ISBN13}`,
  info_url: 'https://openlibrary.org/books/OL26211088M/Atomic_Habits',
  details: {
    title: 'Atomic Habits',
    physical_format: 'Hardcover',
    languages: [{ key: '/languages/eng' }],
    edition_name: '1st edition',
    covers: [8739161],
    number_of_pages: 319,
  },
}

/** A `search.json` reply carrying one work. */
function searchBody(doc: unknown) {
  return { numFound: 1, docs: [doc] }
}

/** Answers all three requests a lookup makes from fixtures. */
function stubFetch(data: unknown, details: unknown, search: unknown = { numFound: 0, docs: [] }, status = 200): LookupFetch {
  return async (url) => {
    const body = url.includes('/search.json') ? search : url.includes('jscmd=details') ? details : data
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }
}

describe('open library lookup', () => {
  it('merges the data and details records into one normalised book', async () => {
    const client = createOpenLibraryClient(stubFetch({ [`ISBN:${ISBN13}`]: DATA_RECORD }, { [`ISBN:${ISBN13}`]: DETAILS_RECORD }))
    const metadata = await client.lookup(ISBN13)

    expect(metadata).toMatchObject({
      isbn: ISBN13,
      title: 'Atomic Habits',
      subtitle: 'An Easy & Proven Way to Build Good Habits',
      authors: ['James Clear'],
      publisher: 'Avery',
      publicationYear: 2018,
      pages: 319,
      edition: '1st edition',
      format: 'Hardcover',
      language: 'English',
      coverUrl: 'https://covers.openlibrary.org/b/id/8739161-L.jpg',
      sourceUrl: 'https://openlibrary.org/books/OL26211088M/Atomic_Habits',
    })
  })

  it('asks for the ISBN-10 form alongside the ISBN-13 and accepts a match on either', async () => {
    const fetchImpl = vi.fn<LookupFetch>(stubFetch({ [`ISBN:${ISBN10}`]: DATA_RECORD }, {}))
    const client = createOpenLibraryClient(fetchImpl)
    const metadata = await client.lookup(ISBN13)

    expect(metadata?.title).toBe('Atomic Habits')
    const [url] = fetchImpl.mock.calls[0]
    expect(decodeURIComponent(url)).toContain(`bibkeys=ISBN:${ISBN13},ISBN:${ISBN10}`)
  })

  it('still returns a book when only one of the two edition requests succeeds', async () => {
    const client = createOpenLibraryClient(async (url) => {
      if (url.includes('jscmd=data')) return new Response(JSON.stringify({ [`ISBN:${ISBN13}`]: DATA_RECORD }), { status: 200 })
      throw new TypeError('offline')
    })
    const metadata = await client.lookup(ISBN13)
    expect(metadata?.title).toBe('Atomic Habits')
    // `details` carries the format and language, so those stay blank.
    expect(metadata?.format).toBe('')
    expect(metadata?.language).toBe('')
  })

  it('fills an edition record that has no author from the matching work', async () => {
    // Open Library is full of bare ISBN records like this one.
    const sparse = { title: 'Atomic Habits', key: '/books/OL60573595M', publishers: [{ name: 'Avery publishing' }], publish_date: 'October 16 2017' }
    const client = createOpenLibraryClient(
      stubFetch(
        { [`ISBN:${ISBN13}`]: sparse },
        {},
        searchBody({ key: '/works/OL17930368W', title: 'Atomic habits', author_name: ['James Clear'], cover_i: 12539702, subject: ['Habit'], language: ['eng', 'ger'] }),
      ),
    )
    const metadata = await client.lookup(ISBN13)

    expect(metadata?.authors).toEqual(['James Clear'])
    expect(metadata?.subjects).toEqual(['Habit'])
    expect(metadata?.coverUrl).toBe('https://covers.openlibrary.org/b/id/12539702-L.jpg')
    // A work published in several languages says nothing about this copy.
    expect(metadata?.language).toBe('')
  })

  it('takes the language from a work published in exactly one', async () => {
    const sparse = { title: 'Atomic Habits' }
    const client = createOpenLibraryClient(stubFetch({ [`ISBN:${ISBN13}`]: sparse }, {}, searchBody({ title: 'Atomic Habits', language: ['eng'] })))
    await expect(client.lookup(ISBN13)).resolves.toMatchObject({ language: 'English' })
  })

  it('ignores a search hit for a different book — `q=isbn:` falls back to fuzzy matching', async () => {
    const client = createOpenLibraryClient(
      stubFetch({ [`ISBN:${ISBN13}`]: { title: 'Atomic Habits' } }, {}, searchBody({ title: 'Polk Gulch', author_name: ['Blaine Dixon'], cover_i: 999 })),
    )
    const metadata = await client.lookup(ISBN13)
    expect(metadata?.title).toBe('Atomic Habits')
    expect(metadata?.authors).toEqual([])
    expect(metadata?.coverUrl).toBe('')
  })

  it('will not build a book out of a search hit alone', async () => {
    const client = createOpenLibraryClient(stubFetch({}, {}, searchBody({ title: 'Polk Gulch', author_name: ['Blaine Dixon'] })))
    await expect(client.lookup(ISBN13)).resolves.toBeNull()
  })

  it('rewrites the http links Open Library returns', async () => {
    const client = createOpenLibraryClient(stubFetch({ [`ISBN:${ISBN13}`]: { title: 'Atomic Habits', url: 'http://openlibrary.org/books/OL60573595M/Atomic_Habits' } }, {}))
    await expect(client.lookup(ISBN13)).resolves.toMatchObject({ sourceUrl: 'https://openlibrary.org/books/OL60573595M/Atomic_Habits' })
  })

  it('reports a miss as null rather than an error', async () => {
    const client = createOpenLibraryClient(stubFetch({}, {}))
    await expect(client.lookup(ISBN13)).resolves.toBeNull()
  })

  it('treats a record with no title as a miss', async () => {
    const client = createOpenLibraryClient(stubFetch({ [`ISBN:${ISBN13}`]: { key: '/books/OL1M' } }, {}))
    await expect(client.lookup(ISBN13)).resolves.toBeNull()
  })

  it('fails when the network is unreachable, and does not cache the failure', async () => {
    const fetchImpl = vi.fn<LookupFetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const client = createOpenLibraryClient(fetchImpl)
    await expect(client.lookup(ISBN13)).rejects.toMatchObject({ code: 'NETWORK' })

    fetchImpl.mockImplementation(stubFetch({ [`ISBN:${ISBN13}`]: DATA_RECORD }, {}))
    await expect(client.lookup(ISBN13)).resolves.toMatchObject({ title: 'Atomic Habits' })
  })

  it('surfaces an Open Library outage as a server error', async () => {
    const client = createOpenLibraryClient(stubFetch({}, {}, undefined, 503))
    await expect(client.lookup(ISBN13)).rejects.toMatchObject({ code: 'SERVER_ERROR' })
  })

  it('shares one in-flight request between a prefetch and the lookup that follows', async () => {
    const fetchImpl = vi.fn<LookupFetch>(stubFetch({ [`ISBN:${ISBN13}`]: DATA_RECORD }, {}))
    const client = createOpenLibraryClient(fetchImpl)
    client.prefetch(ISBN13)
    await client.lookup(`ISBN ${ISBN13}`)
    // One round of requests for the pair of calls, not two.
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('does not call out for an unusable ISBN', async () => {
    const fetchImpl = vi.fn<LookupFetch>()
    const client = createOpenLibraryClient(fetchImpl)
    await expect(client.lookup('')).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('open library field mapping', () => {
  it('reads a year out of the shapes Open Library publishes', () => {
    const now = new Date('2026-09-06T00:00:00Z')
    expect(parsePublishYear('October 16, 2018', now)).toBe(2018)
    expect(parsePublishYear('2018-10', now)).toBe(2018)
    expect(parsePublishYear('1st ed. 1999', now)).toBe(1999)
    expect(parsePublishYear('n.d.', now)).toBeNull()
    expect(parsePublishYear('3021', now)).toBeNull()
    expect(parsePublishYear(undefined, now)).toBeNull()
  })

  it('maps physical formats onto the formats the form offers', () => {
    expect(mapFormat('Mass Market Paperback')).toBe('Mass Market')
    expect(mapFormat('Trade paperback')).toBe('Trade Paperback')
    expect(mapFormat('hardback')).toBe('Hardcover')
    expect(mapFormat('Paperback')).toBe('Paperback')
    expect(mapFormat('Unknown Binding')).toBe('')
    expect(mapFormat(undefined)).toBe('')
  })

  it('maps language keys to names, ignoring codes it does not know', () => {
    expect(mapLanguage([{ key: '/languages/mal' }])).toBe('Malayalam')
    expect(mapLanguage([{ key: '/languages/zzz' }, { key: '/languages/fre' }])).toBe('French')
    expect(mapLanguage([])).toBe('')
  })

  it('only suggests genres the library already keeps', () => {
    expect(matchGenre(['Habit', 'Self-Help'], ['Fiction', 'Self-help'])).toBe('Self-help')
    expect(matchGenre(['Science fiction, American'], ['Fiction', 'Science Fiction'])).toBe('Science Fiction')
    expect(matchGenre(['Habit'], ['Fiction'])).toBe('')
    expect(matchGenre(['Habit'], [])).toBe('')
  })

  it('turns a record into form values, joining the subtitle onto the title', () => {
    const input = metadataToInput(
      {
        isbn: ISBN13,
        title: 'Atomic Habits',
        subtitle: 'An Easy & Proven Way',
        authors: ['James Clear', 'A. Second', 'B. Third', 'C. Fourth'],
        publisher: 'Avery',
        publicationYear: 2018,
        pages: 319,
        edition: '1st edition',
        format: 'Hardcover',
        language: 'English',
        subjects: ['Self-Help'],
        coverUrl: 'https://covers.openlibrary.org/b/id/8739161-L.jpg',
        sourceUrl: 'https://openlibrary.org/books/OL26211088M/Atomic_Habits',
      },
      [{ name: 'Self-help' }],
    )

    expect(input).toEqual({
      title: 'Atomic Habits: An Easy & Proven Way',
      author: 'James Clear, A. Second, B. Third',
      genre: 'Self-help',
      language: 'English',
      publisher: 'Avery',
      publicationYear: 2018,
      edition: '1st edition',
      pages: 319,
      format: 'Hardcover',
      coverUrl: 'https://covers.openlibrary.org/b/id/8739161-L.jpg',
    })
    // The ISBN is never taken from Open Library: the scan is the authority.
    expect(input).not.toHaveProperty('isbn')
  })
})

describe('isbn candidates', () => {
  it('pairs a 978 ISBN-13 with its ISBN-10', () => {
    expect(isbnCandidates(ISBN13)).toEqual([ISBN13, ISBN10])
  })

  it('leaves 979 ISBNs and ISBN-10s on their own', () => {
    expect(isbnCandidates('9791234567896')).toEqual(['9791234567896'])
    expect(isbnCandidates(ISBN10)).toEqual([ISBN10])
  })
})
