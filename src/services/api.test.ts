import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient, describeError, type Transport } from './api'

const URL_OK = 'https://script.google.com/macros/s/TEST/exec'
const TOKEN = 'v1|reader%40spine.test|1|9999999999999|abc123'

/** A client pointed at a fixed backend, signed in unless `token` says otherwise. */
function client(options: { transport?: Transport; url?: string | null; token?: string | null; onUnauthorized?: () => void } = {}) {
  return createApiClient({
    transport: options.transport,
    resolveUrl: () => (options.url === undefined ? URL_OK : options.url),
    resolveToken: () => (options.token === undefined ? TOKEN : options.token),
    onUnauthorized: options.onUnauthorized ?? (() => {}),
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('posts the action envelope to the configured backend as text/plain and unwraps data', async () => {
    const transport = vi.fn<Transport>(async () => jsonResponse({ ok: true, data: { books: [], total: 0 } }))
    const result = await client({ transport }).getBooks({ status: 'Read' })
    expect(result).toEqual({ books: [], total: 0 })
    expect(transport).toHaveBeenCalledTimes(1)
    const [url, envelope] = transport.mock.calls[0]
    expect(url).toBe(URL_OK)
    expect(envelope).toEqual({ action: 'getBooks', payload: { status: 'Read' }, token: TOKEN })
    // Never in the URL.
    expect(url).not.toContain(TOKEN)
  })

  it('sends login without a token, and never in the URL', async () => {
    const transport = vi.fn<Transport>(async () => jsonResponse({ ok: true, data: { token: 'fresh', expiresAt: 1, username: 'a@b.c', version: '1.0.0', library: 'Home', books: 3 } }))
    const result = await client({ transport, token: null }).login({ username: 'a@b.c', password: 'hunter2' })
    expect(result.token).toBe('fresh')
    const [url, envelope] = transport.mock.calls[0]
    expect(envelope).toEqual({ action: 'login', payload: { username: 'a@b.c', password: 'hunter2' } })
    expect(envelope).not.toHaveProperty('token')
    expect(url).not.toContain('hunter2')
  })

  it('refuses to send any other action while signed out', async () => {
    const transport = vi.fn<Transport>()
    await expect(client({ transport, token: null }).getStats()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(transport).not.toHaveBeenCalled()
  })

  it('fails fast when the build has no backend URL', async () => {
    const transport = vi.fn<Transport>()
    await expect(client({ transport, url: null }).getStats()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    expect(transport).not.toHaveBeenCalled()
  })

  it('ends the session when the backend rejects our token', async () => {
    const onUnauthorized = vi.fn()
    const api = client({ transport: async () => jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Your session has ended.' } }), onUnauthorized })
    await expect(api.getStats()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not end the session when a sign-in attempt is refused', async () => {
    const onUnauthorized = vi.fn()
    const api = client({ transport: async () => jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'nope' } }), token: null, onUnauthorized })
    await expect(api.login({ username: 'a@b.c', password: 'wrong' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('surfaces backend errors as ApiError with the code and details', async () => {
    const duplicate = { isbn: '9780735211292', title: 'Atomic Habits', author: 'James Clear', copies: [] }
    const api = client({ transport: async () => jsonResponse({ ok: false, error: { code: 'DUPLICATE', message: 'You already have this book.', details: { duplicate } } }) })
    const error = await api.addBook({ title: 'x', author: 'y' } as never).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('DUPLICATE')
    expect(error.isDuplicate).toBe(true)
    expect(error.duplicate).toEqual(duplicate)
  })

  it('maps a malformed backend response', async () => {
    const api = client({ transport: async () => new Response('<html>Sorry</html>', { status: 200 }) })
    await expect(api.getGenres()).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' })
    const api2 = client({ transport: async () => jsonResponse({ something: 'else' }) })
    await expect(api2.getGenres()).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' })
  })

  it('maps backend failures and network errors', async () => {
    const down = client({ transport: async () => new Response('', { status: 503 }) })
    await expect(down.getGenres()).rejects.toMatchObject({ code: 'SERVER_ERROR', retryable: true })

    const offline = client({
      transport: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await expect(offline.getGenres()).rejects.toMatchObject({ code: 'NETWORK', retryable: true })

    const limited = client({ transport: async () => new Response('', { status: 429 }) })
    await expect(limited.getGenres()).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('times out and reports TIMEOUT', async () => {
    vi.useFakeTimers()
    const api = client({
      transport: (_url, _envelope, signal) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    })
    const promise = api.getGenres()
    const expectation = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(30_000)
    await expectation
    vi.useRealTimers()
  })

  it('describes errors in plain language', () => {
    expect(describeError(new ApiError('UNAUTHORIZED', ''))).toMatch(/username and password/)
    expect(describeError(new ApiError('NOT_FOUND', 'x'))).toMatch(/find that book/)
    expect(describeError(new ApiError('NOT_CONFIGURED', ''))).toMatch(/not set up/)
    expect(describeError(new Error('Exception: SpreadsheetApp.openById'))).toBe('Something went wrong. Please try again.')
  })
})
