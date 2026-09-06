import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient, describeError, type Transport } from './api'
import { auth } from './auth'
import { config } from './config'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('api client', () => {
  beforeEach(() => {
    config.appsScriptUrl = 'https://script.google.com/macros/s/TEST/exec'
    config.googleClientId = 'test-client'
    vi.spyOn(auth, 'getToken').mockReturnValue('token-123')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    config.appsScriptUrl = ''
  })

  it('sends the action envelope as a simple text/plain POST and unwraps data', async () => {
    const transport = vi.fn<Transport>(async () => jsonResponse({ ok: true, data: { books: [], total: 0 } }))
    const api = createApiClient(transport)
    const result = await api.getBooks({ status: 'Read' })
    expect(result).toEqual({ books: [], total: 0 })
    expect(transport).toHaveBeenCalledTimes(1)
    const [envelope] = transport.mock.calls[0]
    expect(envelope).toEqual({ action: 'getBooks', payload: { status: 'Read' }, idToken: 'token-123' })
  })

  it('surfaces backend errors as ApiError with the code and details', async () => {
    const duplicate = { isbn: '9780735211292', title: 'Atomic Habits', author: 'James Clear', copies: [] }
    const api = createApiClient(async () => jsonResponse({ ok: false, error: { code: 'DUPLICATE', message: 'You already have this book.', details: { duplicate } } }))
    const error = await api.addBook({ title: 'x', author: 'y' } as never).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('DUPLICATE')
    expect(error.isDuplicate).toBe(true)
    expect(error.duplicate).toEqual(duplicate)
  })

  it('fails fast without a token (unauthorized request)', async () => {
    vi.spyOn(auth, 'getToken').mockReturnValue(null)
    const transport = vi.fn<Transport>()
    const api = createApiClient(transport)
    await expect(api.getStats()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(transport).not.toHaveBeenCalled()
  })

  it('invalidates the session when the backend rejects the token', async () => {
    const invalidate = vi.spyOn(auth, 'invalidate')
    const api = createApiClient(async () => jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'expired' } }))
    await expect(api.getStats()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(invalidate).toHaveBeenCalled()
  })

  it('maps a malformed backend response', async () => {
    const api = createApiClient(async () => new Response('<html>Sorry</html>', { status: 200 }))
    await expect(api.getGenres()).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' })
    const api2 = createApiClient(async () => jsonResponse({ something: 'else' }))
    await expect(api2.getGenres()).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' })
  })

  it('maps backend failures and network errors', async () => {
    const down = createApiClient(async () => new Response('', { status: 503 }))
    await expect(down.getGenres()).rejects.toMatchObject({ code: 'SERVER_ERROR', retryable: true })

    const offline = createApiClient(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(offline.getGenres()).rejects.toMatchObject({ code: 'NETWORK', retryable: true })

    const limited = createApiClient(async () => new Response('', { status: 429 }))
    await expect(limited.getGenres()).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('times out and reports TIMEOUT', async () => {
    vi.useFakeTimers()
    const api = createApiClient(
      (_envelope, signal) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const promise = api.getGenres()
    const expectation = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(30_000)
    await expectation
    vi.useRealTimers()
  })

  it('refuses to run without configuration', async () => {
    config.appsScriptUrl = ''
    await expect(createApiClient(vi.fn<Transport>()).getGenres()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
  })

  it('only talks to script.google.com in production builds', async () => {
    vi.stubEnv('DEV', false)
    try {
      config.appsScriptUrl = 'https://evil.example/exec'
      await expect(createApiClient(vi.fn<Transport>()).getGenres()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
      config.appsScriptUrl = 'http://localhost:8787'
      await expect(createApiClient(vi.fn<Transport>()).getGenres()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('describes errors in plain language', () => {
    expect(describeError(new ApiError('FORBIDDEN', 'x'))).toMatch(/not allowed/)
    expect(describeError(new ApiError('NOT_FOUND', 'x'))).toMatch(/find that book/)
    expect(describeError(new Error('Exception: SpreadsheetApp.openById'))).toBe('Something went wrong. Please try again.')
  })
})
