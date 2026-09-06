/**
 * Centralised API client. This is the only module that talks to the network.
 *
 * Transport notes:
 *  - Apps Script web apps cannot answer CORS pre-flight requests, so every call
 *    is a "simple" POST with a text/plain body. The JSON action envelope and
 *    the session token travel in that body, never in headers or the URL.
 *  - Apps Script answers with a 302 to script.googleusercontent.com; `fetch`
 *    follows it transparently.
 *  - Which deployment we talk to is fixed at build time (services/config.ts).
 *    Who is calling comes from the stored session (services/session.ts): every
 *    action but `login` carries a token, and a token the backend rejects ends
 *    the session here so the app falls back to the sign-in screen.
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
  LoginParams,
  LoginResult,
  PingResult,
  UpdateBookParams,
} from '@/types'
import { resolveBackendUrl } from './config'
import { session } from './session'

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
      return apiError.message || 'That username and password do not match.'
    case 'NOT_FOUND':
      return "We couldn't find that book. It may have been deleted."
    case 'VALIDATION':
    case 'BAD_REQUEST':
      return apiError.message || 'Please check the details and try again.'
    case 'RATE_LIMITED':
      return 'Too many attempts right now. Wait a moment and try again.'
    case 'NOT_CONFIGURED':
      return apiError.message || 'This library is not set up yet.'
    case 'MALFORMED_RESPONSE':
      return "That address answered, but not like a Spine library. Check the deployment URL ends in /exec."
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
  /** Present on every action except `login`, which is how you get one. */
  token?: string
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

export interface ApiClientOptions {
  transport?: Transport
  /** The backend to call; defaults to the build-time deployment URL. */
  resolveUrl?: () => string | null
  /** The session token to attach; defaults to the stored session. */
  resolveToken?: () => string | null
  /** Called when the backend rejects our token, so the app can sign out. */
  onUnauthorized?: () => void
}

/** Only `login` may travel without a token. */
const PUBLIC_ACTIONS = new Set<ApiAction>(['login'])

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const {
    transport = defaultTransport,
    resolveUrl = resolveBackendUrl,
    resolveToken = session.getToken,
    onUnauthorized = session.end,
  } = options

  async function call<T>(action: ApiAction, payload: unknown = {}): Promise<T> {
    const url = resolveUrl()
    if (!url) {
      throw new ApiError('NOT_CONFIGURED', 'This app has no library configured. Set VITE_APPS_SCRIPT_URL and redeploy.')
    }

    const envelope: Envelope = { action, payload }
    if (!PUBLIC_ACTIONS.has(action)) {
      const token = resolveToken()
      if (!token) throw new ApiError('UNAUTHORIZED', 'Please sign in to use this library.')
      envelope.token = token
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    console.debug(`[spine] → ${action}`, { url, payload: redact(action, payload), token: envelope.token ? 'present' : 'absent' })

    let response: Response
    try {
      response = await transport(url, envelope, controller.signal)
    } catch (error) {
      console.error(`[spine] ✕ ${action}: request failed before a response arrived`, error)
      throw toApiError(error)
    } finally {
      clearTimeout(timer)
    }

    console.debug(`[spine] ← ${action}: HTTP ${response.status}`, { finalUrl: response.url, contentType: response.headers.get('content-type') })
    if (response.status === 429) throw new ApiError('RATE_LIMITED', 'Too many requests. Please wait a moment.')
    if (response.status >= 500) throw new ApiError('SERVER_ERROR', 'Your library is temporarily unavailable.')

    // Read as text first so a non-JSON reply (e.g. a Google sign-in or error
    // page) can be logged instead of vanishing into a parse error.
    const text = await response.text()
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      console.error(`[spine] ✕ ${action}: reply is not JSON. First 500 chars:\n${text.slice(0, 500)}`)
      throw new ApiError('MALFORMED_RESPONSE', 'Received an unexpected reply from your library.')
    }
    if (!isApiResponse(body)) {
      console.error(`[spine] ✕ ${action}: reply is JSON but not a Spine envelope`, body)
      throw new ApiError('MALFORMED_RESPONSE', 'Received an unexpected reply from your library.')
    }

    if (!body.ok) {
      const { code, message, details } = body.error
      console.error(`[spine] ✕ ${action}: backend replied ${code}: ${message}`, details ?? '')
      // Our token was refused (expired, or the password changed): stop pretending
      // we are signed in, so the app shows the sign-in screen instead of looping.
      if (code === 'UNAUTHORIZED' && !PUBLIC_ACTIONS.has(action)) onUnauthorized()
      throw new ApiError(code, message, details)
    }
    console.debug(`[spine] ✓ ${action}`, action === 'login' ? '(session established)' : body.data)
    return body.data as T
  }

  return {
    login: (params) => call<LoginResult>('login', params satisfies LoginParams),
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

/** Keep the password out of the console, even in development. */
function redact(action: ApiAction, payload: unknown): unknown {
  if (action !== 'login' || !payload || typeof payload !== 'object') return payload
  return { ...(payload as Record<string, unknown>), password: '••••••' }
}

export const api: ApiClient = createApiClient()
