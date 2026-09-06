/**
 * Centralised API client. This is the only module that talks to the network.
 *
 * Transport notes:
 *  - Apps Script web apps cannot answer CORS pre-flight requests, so every call
 *    is a "simple" POST with a text/plain body. The JSON action envelope and
 *    the optional access key travel in that body, never in headers or the URL.
 *  - Apps Script answers with a 302 to script.googleusercontent.com; `fetch`
 *    follows it transparently.
 *  - Which deployment we talk to comes from the active connection
 *    (services/connections.ts); there is no sign-in.
 */
import type {
  AddBookParams,
  ApiAction,
  ApiClient,
  ApiErrorCode,
  ApiResponse,
  Book,
  ChangeStatusParams,
  CheckIsbnResult,
  DuplicateMatch,
  Genre,
  GetBooksParams,
  GetBooksResult,
  LibraryStats,
  PingResult,
  UpdateBookParams,
} from '@/types'
import { isValidAppsScriptUrl } from './config'
import { connections, type ConnectionTarget } from './connections'

export const REQUEST_TIMEOUT_MS = 25_000

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }

  get isDuplicate(): boolean {
    return this.code === 'DUPLICATE'
  }

  get duplicate(): DuplicateMatch | null {
    const value = this.details?.duplicate
    return value && typeof value === 'object' ? (value as DuplicateMatch) : null
  }

  /** Whether retrying the same request could plausibly succeed. */
  get retryable(): boolean {
    return ['NETWORK', 'TIMEOUT', 'SERVER_ERROR', 'RATE_LIMITED', 'MALFORMED_RESPONSE'].includes(this.code)
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError('TIMEOUT', 'The request took too long. Please try again.')
  }
  if (error instanceof TypeError) {
    return new ApiError('NETWORK', 'Could not reach your library. Check your connection and try again.')
  }
  return new ApiError('SERVER_ERROR', 'Something went wrong. Please try again.')
}

/** Human-friendly copy for each failure class. Never surfaces raw backend text. */
export function describeError(error: unknown): string {
  const apiError = toApiError(error)
  switch (apiError.code) {
    case 'UNAUTHORIZED':
      return 'This library needs a different access key.'
    case 'NOT_FOUND':
      return "We couldn't find that book. It may have been deleted."
    case 'VALIDATION':
    case 'BAD_REQUEST':
      return apiError.message || 'Please check the details and try again.'
    case 'RATE_LIMITED':
      return 'Too many requests right now. Wait a moment and try again.'
    case 'NOT_CONFIGURED':
      return 'No library is connected yet.'
    case 'MALFORMED_RESPONSE':
      return "That address answered, but not like a Spine library. Check it's the web-app URL ending in /exec."
    case 'NETWORK':
    case 'TIMEOUT':
    case 'SERVER_ERROR':
    default:
      return apiError.message || 'Something went wrong. Please try again.'
  }
}

interface Envelope {
  action: ApiAction
  payload: unknown
  /** Present only when the connection has an access key. */
  key?: string
}

export interface Transport {
  (url: string, envelope: Envelope, signal: AbortSignal): Promise<Response>
}

const defaultTransport: Transport = (url, envelope, signal) =>
  fetch(url, {
    method: 'POST',
    // text/plain keeps this a CORS "simple request" (no pre-flight), which is
    // the only shape Apps Script can serve cross-origin.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(envelope),
    signal,
    redirect: 'follow',
    credentials: 'omit',
  })

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.ok === true) return 'data' in record
  if (record.ok === false) {
    const err = record.error as Record<string, unknown> | undefined
    return Boolean(err && typeof err.code === 'string' && typeof err.message === 'string')
  }
  return false
}

/**
 * @param transport network layer (swapped out in tests)
 * @param resolveTarget where to send requests; defaults to the active connection
 */
export function createApiClient(transport: Transport = defaultTransport, resolveTarget: () => ConnectionTarget | null = connections.getActiveTarget): ApiClient {
  async function call<T>(action: ApiAction, payload: unknown = {}): Promise<T> {
    const target = resolveTarget()
    if (!target || !isValidAppsScriptUrl(target.url)) {
      throw new ApiError('NOT_CONFIGURED', 'No library is connected yet.')
    }
    const envelope: Envelope = target.accessKey ? { action, payload, key: target.accessKey } : { action, payload }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await transport(target.url, envelope, controller.signal)
    } catch (error) {
      throw toApiError(error)
    } finally {
      clearTimeout(timer)
    }

    if (response.status === 429) throw new ApiError('RATE_LIMITED', 'Too many requests. Please wait a moment.')
    if (response.status >= 500) throw new ApiError('SERVER_ERROR', 'Your library is temporarily unavailable.')

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new ApiError('MALFORMED_RESPONSE', 'Received an unexpected reply from your library.')
    }
    if (!isApiResponse(body)) {
      throw new ApiError('MALFORMED_RESPONSE', 'Received an unexpected reply from your library.')
    }

    if (!body.ok) {
      const { code, message, details } = body.error
      throw new ApiError(code, message, details)
    }
    return body.data as T
  }

  return {
    ping: () => call<PingResult>('ping'),
    getBooks: (params = {}) => call<GetBooksResult>('getBooks', params satisfies GetBooksParams),
    getBook: (id) => call<Book>('getBook', { id }),
    searchBooks: (query) => call<Book[]>('searchBooks', { query }),
    getGenres: () => call<Genre[]>('getGenres'),
    getStats: () => call<LibraryStats>('getStats'),
    checkIsbn: (isbn) => call<CheckIsbnResult>('checkIsbn', { isbn }),
    addBook: (params) => call<Book>('addBook', params satisfies AddBookParams),
    updateBook: (params) => call<Book>('updateBook', params satisfies UpdateBookParams),
    deleteBook: (id) => call<void>('deleteBook', { id }),
    changeStatus: (params) => call<Book>('changeStatus', params satisfies ChangeStatusParams),
  }
}

export const api: ApiClient = createApiClient()

/** Verify a not-yet-saved connection: does this URL (and key) reach a Spine backend? */
export function probeConnection(target: ConnectionTarget, transport: Transport = defaultTransport): Promise<PingResult> {
  return createApiClient(transport, () => target).ping()
}
