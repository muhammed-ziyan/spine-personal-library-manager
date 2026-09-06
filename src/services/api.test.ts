import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient, describeError, probeConnection, type Transport } from './api'
import type { ConnectionTarget } from './connections'

const TARGET: ConnectionTarget = { url: 'https://script.google.com/macros/s/TEST/exec', accessKey: '' }
const KEYED: ConnectionTarget = { ...TARGET, accessKey: 'shh' }
const at = (target: ConnectionTarget | null) => () => target

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('posts the action envelope to the active connection as text/plain and unwraps data', async () => {
    const transport = vi.fn<Transport>(async () => jsonResponse({ ok: true, data: { books: [], total: 0 } }))
    const api = createApiClient(transport, at(TARGET))
    const result = await api.getBooks({ status: 'Read' })
    expect(result).toEqual({ books: [], total: 0 })
    expect(transport).toHaveBeenCalledTimes(1)
    const [url, envelope] = transport.mock.calls[0]
    expect(url).toBe(TARGET.url)
    // No key field at all when the connection has no access key.
    expect(envelope).toEqual({ action: 'getBooks', payload: { status: 'Read' } })
  })

  it('attaches the access key in the body when the connection has one', async () => {
    const transport = vi.fn<Transport>(async () => jsonResponse({ ok: true, data: [] }))
    await createApiClient(transport, at(KEYED)).getGenres()
    const [url, envelope] = transport.mock.calls[0]
    expect(envelope).toEqual({ action: 'getGenres', payload: {}, key: 'shh' })
    // Never in the URL.
    expect(url).not.toContain('shh')
  })

  it('fails fast when no library is connected', async () => {
    const transport = vi.fn<Transport>()
    await expect(createApiClient(transport, at(null)).getStats()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    expect(transport).not.toHaveBeenCalled()
  })

  it('surfaces backend errors as ApiError with the code and details', async () => {
    const duplicate = { isbn: '9780735211292', title: 'Atomic Habits', author: 'James Clear', copies: [] }
    const api = createApiClient(async () => jsonResponse({ ok: false, error: { code: 'DUPLICATE', message: 'You already have this book.', details: { duplicate } } }), at(TARGET))
    const error = await api.addBook({ title: 'x', author: 'y' } as never).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('DUPLICATE')
    expect(error.isDuplicate).toBe(true)
    expect(error.duplicate).toEqual(duplicate)
  })

  it('reports a rejected access key as UNAUTHORIZED', async () => {
    const api = createApiClient(async () => jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'nope' } }), at(KEYED))
    await expect(api.getStats()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('maps a malformed backend response', async () => {
    const api = createApiClient(async () => new Response('<html>Sorry</html>', { status: 200 }), at(TARGET))
    await expect(api.getGenres()).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' })
    const api2 = createApiClient(async () => jsonResponse({ something: 'else' }), at(TARGET))
    await expect(api2.getGenres()).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' })
  })

  it('maps backend failures and network errors', async () => {
    const down = createApiClient(async () => new Response('', { status: 503 }), at(TARGET))
    await expect(down.getGenres()).rejects.toMatchObject({ code: 'SERVER_ERROR', retryable: true })

    const offline = createApiClient(async () => {
      throw new TypeError('Failed to fetch')
    }, at(TARGET))
    await expect(offline.getGenres()).rejects.toMatchObject({ code: 'NETWORK', retryable: true })

    const limited = createApiClient(async () => new Response('', { status: 429 }), at(TARGET))
    await expect(limited.getGenres()).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('times out and reports TIMEOUT', async () => {
    vi.useFakeTimers()
    const api = createApiClient(
      (_url, _envelope, signal) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
      at(TARGET),
    )
    const promise = api.getGenres()
    const expectation = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(30_000)
    await expectation
    vi.useRealTimers()
  })

  it('only talks to script.google.com in production builds', async () => {
    vi.stubEnv('DEV', false)
    const transport = vi.fn<Transport>()
    await expect(createApiClient(transport, at({ url: 'https://evil.example/exec', accessKey: '' })).getGenres()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    await expect(createApiClient(transport, at({ url: 'http://localhost:8787', accessKey: '' })).getGenres()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    expect(transport).not.toHaveBeenCalled()
  })

  it('probes a not-yet-saved connection with ping', async () => {
    const transport = vi.fn<Transport>(async () => jsonResponse({ ok: true, data: { version: '1.0.0', library: 'Home shelf', books: 12 } }))
    const result = await probeConnection(KEYED, transport)
    expect(result).toEqual({ version: '1.0.0', library: 'Home shelf', books: 12 })
    const [url, envelope] = transport.mock.calls[0]
    expect(url).toBe(KEYED.url)
    expect(envelope).toEqual({ action: 'ping', payload: {}, key: 'shh' })
  })

  it('describes errors in plain language', () => {
    expect(describeError(new ApiError('UNAUTHORIZED', 'x'))).toMatch(/access key/)
    expect(describeError(new ApiError('NOT_FOUND', 'x'))).toMatch(/find that book/)
    expect(describeError(new ApiError('NOT_CONFIGURED', 'x'))).toMatch(/No library/)
    expect(describeError(new Error('Exception: SpreadsheetApp.openById'))).toBe('Something went wrong. Please try again.')
  })
})
