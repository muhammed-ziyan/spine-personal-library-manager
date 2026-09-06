/**
 * Loads the real Apps Script sources (*.gs) into a sandboxed VM with
 * in-memory stand-ins for the Google services they use. Tests then exercise
 * `handleRequest_` exactly as doPost would.
 *
 * Written in erasable TypeScript only (no enums / parameter properties) so
 * Node can run it directly for the local dev backend (scripts/dev-backend.ts).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

type Cell = string | number | Date | null

class MockRange {
  private sheet: MockSheet
  private row: number
  private col: number
  private numRows: number
  private numCols: number

  constructor(sheet: MockSheet, row: number, col: number, numRows: number, numCols: number) {
    this.sheet = sheet
    this.row = row
    this.col = col
    this.numRows = numRows
    this.numCols = numCols
  }

  getValues(): Cell[][] {
    const out: Cell[][] = []
    for (let r = 0; r < this.numRows; r++) {
      const line: Cell[] = []
      for (let c = 0; c < this.numCols; c++) line.push(this.sheet.cell(this.row + r, this.col + c))
      out.push(line)
    }
    return out
  }

  setValues(values: Cell[][]) {
    values.forEach((line, r) => line.forEach((value, c) => this.sheet.setCell(this.row + r, this.col + c, value)))
    return this
  }

  getValue(): Cell {
    return this.sheet.cell(this.row, this.col)
  }

  setValue(value: Cell) {
    this.sheet.setCell(this.row, this.col, value)
    return this
  }

  setNumberFormat() {
    return this
  }
}

export class MockSheet {
  rows: Cell[][] = []
  private name: string

  constructor(name: string) {
    this.name = name
  }

  getName() {
    return this.name
  }

  cell(row: number, col: number): Cell {
    const line = this.rows[row - 1]
    const value = line ? line[col - 1] : undefined
    return value === undefined || value === null ? '' : value
  }

  setCell(row: number, col: number, value: Cell) {
    while (this.rows.length < row) this.rows.push([])
    const line = this.rows[row - 1]
    while (line.length < col) line.push('')
    // Emulate Sheets' text-prefix behaviour: a leading apostrophe forces text
    // and is stripped from the stored value.
    if (typeof value === 'string' && value.startsWith("'")) value = value.slice(1)
    else if (typeof value === 'string' && /^[=+\-@]/.test(value)) {
      // A real Sheet would evaluate this as a formula. Make it loud in tests.
      throw new Error(`Formula written to ${this.name}!R${row}C${col}: ${value}`)
    }
    line[col - 1] = value
  }

  getLastRow() {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].some((v) => v !== '' && v !== null && v !== undefined)) return i + 1
    }
    return 0
  }

  getLastColumn() {
    return Math.max(0, ...this.rows.map((r) => r.length))
  }

  getMaxRows() {
    return Math.max(1000, this.rows.length)
  }

  getRange(row: number, col: number, numRows = 1, numCols = 1) {
    return new MockRange(this, row, col, numRows, numCols)
  }

  appendRow(values: Cell[]) {
    const row = this.getLastRow() + 1
    values.forEach((value, i) => this.setCell(row, i + 1, value))
    return this
  }

  deleteRow(row: number) {
    this.rows.splice(row - 1, 1)
    return this
  }

  setFrozenRows() {
    return this
  }
}

export class MockSpreadsheet {
  sheets = new Map<string, MockSheet>()
  getName() {
    return 'Spine Test'
  }
  getId() {
    return 'spine-test-spreadsheet'
  }
  getSheets() {
    return Array.from(this.sheets.values())
  }
  getSheetByName(name: string) {
    return this.sheets.get(name) ?? null
  }
  insertSheet(name: string) {
    const sheet = new MockSheet(name)
    this.sheets.set(name, sheet)
    return sheet
  }
}

export interface ApiEnvelopeResult {
  ok: boolean
  data?: unknown
  error?: { code: string; message: string; details?: Record<string, unknown> }
}

export interface Backend {
  handle: (envelope: unknown) => ApiEnvelopeResult
  spreadsheet: MockSpreadsheet
  props: Map<string, string>
  cache: Map<string, string>
  lock: { acquired: number; released: number; failNext: boolean }
  setup: () => void
  /** Sign in and return a fresh token. Throws if the credentials are refused. */
  login: (username?: string, password?: string) => string
  /** A token for `credentials`, minted on creation. Empty when signIn was disabled. */
  token: string
  credentials: { username: string; password: string }
  ctx: vm.Context
}

export const TEST_CREDENTIALS = { username: 'reader@spine.test', password: 'test-password-1234' }

export interface BackendOptions {
  /** Sign-in stored in Script Properties. Defaults to TEST_CREDENTIALS. */
  credentials?: { username: string; password: string }
  /**
   * Leave AUTH_USERNAME/AUTH_PASSWORD unset, as a freshly deployed script is.
   * The API then refuses everything with NOT_CONFIGURED.
   */
  unconfigured?: boolean
}

export function createBackend(options: BackendOptions = {}): Backend {
  const spreadsheet = new MockSpreadsheet()
  const props = new Map<string, string>()
  const credentials = options.credentials ?? TEST_CREDENTIALS
  if (!options.unconfigured) {
    props.set('AUTH_USERNAME', credentials.username)
    props.set('AUTH_PASSWORD', credentials.password)
  }
  const cache = new Map<string, string>()
  const lock = { acquired: 0, released: 0, failNext: false }

  const sandbox: Record<string, unknown> = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: () => spreadsheet,
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => props.set(k, v),
        deleteProperty: (k: string) => props.delete(k),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k) ?? null,
        put: (k: string, v: string) => cache.set(k, v),
        remove: (k: string) => cache.delete(k),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          if (lock.failNext) {
            lock.failNext = false
            return false
          }
          lock.acquired += 1
          return true
        },
        waitLock: () => {
          lock.acquired += 1
        },
        releaseLock: () => {
          lock.released += 1
        },
        hasLock: () => lock.acquired > lock.released,
      }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => ({ setMimeType: () => ({ getContent: () => text }) }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_alg: string, text: string) => signedBytes(createHash('sha256').update(text, 'utf8').digest()),
      computeHmacSha256Signature: (value: string, key: string) => signedBytes(createHmac('sha256', key).update(value, 'utf8').digest()),
      getUuid: () => randomUUID(),
      sleep: () => {},
    },
    Logger: { log: () => {} },
    // The backend logs every request; keep the test output quiet.
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp,
    Error,
    isFinite,
    isNaN,
    encodeURIComponent,
    decodeURIComponent,
  }

  const ctx = vm.createContext(sandbox)
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..')
  const files = readdirSync(dir).filter((f) => f.endsWith('.gs')).sort()
  for (const file of files) {
    vm.runInContext(readFileSync(join(dir, file), 'utf8'), ctx, { filename: file })
  }

  const handleRequest = ctx.handleRequest_ as (raw: string) => ApiEnvelopeResult

  const handle = (envelope: unknown) => handleRequest(typeof envelope === 'string' ? envelope : JSON.stringify(envelope))

  const backend: Backend = {
    handle,
    spreadsheet,
    props,
    cache,
    lock,
    setup: () => (ctx.setupSpreadsheet as () => void)(),
    login: (username = credentials.username, password = credentials.password) => {
      const result = handle({ action: 'login', payload: { username, password } })
      if (!result.ok) throw new Error(`login failed: ${result.error?.code} ${result.error?.message}`)
      return (result.data as { token: string }).token
    },
    token: '',
    credentials,
    ctx,
  }
  backend.setup()
  // Most tests care about the library, not the door; hand them a signed-in session.
  if (!options.unconfigured) backend.token = backend.login()
  return backend
}

/** Signed (Java-style) bytes, which is how Apps Script hands back a digest. */
function signedBytes(buffer: Buffer): number[] {
  return Array.from(buffer as Uint8Array).map((b: number) => (b > 127 ? b - 256 : b))
}

/**
 * Send one action as the signed-in user. Pass `token` explicitly to send a
 * different one, or `null` to send none at all (as an unauthenticated caller).
 */
export function request(backend: Backend, action: string, payload: unknown = {}, token: string | null = backend.token) {
  return backend.handle(token === null ? { action, payload } : { action, payload, token })
}

export const sampleBook = {
  isbn: '978-0-7352-1129-2',
  title: 'Atomic Habits',
  author: 'James Clear',
  genre: 'Self Help',
  subgenre: 'Habits',
  language: 'English',
  publisher: 'Avery',
  publicationYear: 2018,
  edition: '1st',
  pages: 320,
  format: 'Hardcover',
  status: 'Unread',
  rating: null,
  notes: '',
  coverUrl: '',
}
