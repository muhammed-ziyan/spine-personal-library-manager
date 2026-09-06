import type { Book, BookInput, BookPatch, BookStatus, Genre, LibraryStats } from './book'

/** Every action the Apps Script backend understands. Mirrors apps-script/Code.gs. */
export type ApiAction =
  | 'login'
  | 'ping'
  | 'getBooks'
  | 'getBook'
  | 'searchBooks'
  | 'getGenres'
  | 'getStats'
  | 'addBook'
  | 'updateBook'
  | 'deleteBook'
  | 'changeStatus'
  | 'checkIsbn'

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'BAD_REQUEST'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'MALFORMED_RESPONSE'
  | 'NOT_CONFIGURED'

export interface ApiFailure {
  ok: false
  error: { code: ApiErrorCode; message: string; details?: Record<string, unknown> }
}

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export interface LoginParams {
  username: string
  password: string
}

/**
 * Answer to `login`. The token is signed by the deployment and carries its own
 * expiry; the password is never echoed back. The library summary rides along so
 * the app can render straight after signing in.
 */
export interface LoginResult extends PingResult {
  token: string
  /** Epoch milliseconds. */
  expiresAt: number
  username: string
}

/** Answer to `ping`: proves the stored token still works, and names the sheet. */
export interface PingResult {
  version: string
  library: string
  books: number
}

export type SortKey = 'title' | 'author' | 'dateAdded' | 'rating'

export interface GetBooksParams {
  query?: string
  status?: BookStatus
  genre?: string
  language?: string
  sort?: SortKey
  direction?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface GetBooksResult {
  books: Book[]
  total: number
}

export interface DuplicateMatch {
  isbn: string
  title: string
  author: string
  copies: Book[]
}

export interface CheckIsbnResult {
  isbn: string
  duplicate: DuplicateMatch | null
}

export interface AddBookParams extends BookInput {
  /** Set when the user explicitly confirmed adding another physical copy. */
  allowDuplicate?: boolean
}

/** Sent with `error.code === 'DUPLICATE'` when an ISBN already exists and `allowDuplicate` was not set. */
export interface DuplicateErrorDetails {
  duplicate: DuplicateMatch
}

export interface UpdateBookParams {
  id: string
  patch: BookPatch
}

export interface ChangeStatusParams {
  id: string
  status: BookStatus
}

export interface ApiClient {
  /** The only action that needs no token — it is how you get one. */
  login(params: LoginParams): Promise<LoginResult>
  ping(): Promise<PingResult>
  getBooks(params?: GetBooksParams): Promise<GetBooksResult>
  getBook(id: string): Promise<Book>
  searchBooks(query: string): Promise<Book[]>
  getGenres(): Promise<Genre[]>
  getStats(): Promise<LibraryStats>
  checkIsbn(isbn: string): Promise<CheckIsbnResult>
  addBook(params: AddBookParams): Promise<Book>
  updateBook(params: UpdateBookParams): Promise<Book>
  deleteBook(id: string): Promise<void>
  changeStatus(params: ChangeStatusParams): Promise<Book>
}
