/**
 * Loads the real Apps Script sources (*.gs) into a sandboxed VM with
 * in-memory stand-ins for the Google services they use. Tests then exercise
 * `handleRequest_` exactly as doPost would.
 *
 * Written in erasable TypeScript only (no enums / parameter properties) so
 * Node can run it directly for the local dev backend (scripts/dev-backend.ts).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
  getSheetByName(name: string) {
    return this.sheets.get(name) ?? null
  }
  insertSheet(name: string) {
    const sheet = new MockSheet(name)
    this.sheets.set(name, sheet)
    return sheet
  }
}

export interface TokenInfo {
  aud: string
  iss: string
  email: string
  email_verified: string
  exp: number
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
  tokens: Map<string, TokenInfo | 'invalid'>
  readonly fetchCalls: number
  setup: () => void
  ctx: vm.Context
}

export interface BackendOptions {
  allowedEmails?: string
  clientId?: string
  /** Custom tokeninfo resolver (used by the dev backend to accept locally-minted tokens). */
  resolveToken?: (token: string) => TokenInfo | null
}

export const CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
export const OWNER = 'owner@example.com'

export function createBackend(options: BackendOptions = {}): Backend {
  const spreadsheet = new MockSpreadsheet()
  const props = new Map<string, string>([
    ['GOOGLE_CLIENT_ID', options.clientId ?? CLIENT_ID],
    ['ALLOWED_EMAILS', options.allowedEmails ?? OWNER],
  ])
  const cache = new Map<string, string>()
  const lock = { acquired: 0, released: 0, failNext: false }
  const tokens = new Map<string, TokenInfo | 'invalid'>()
  const state = { fetchCalls: 0 }

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
    UrlFetchApp: {
      fetch: (url: string) => {
        state.fetchCalls += 1
        const token = decodeURIComponent(url.split('id_token=')[1] ?? '')
        let info: TokenInfo | 'invalid' | null | undefined = tokens.get(token)
        if (info === undefined && options.resolveToken) info = options.resolveToken(token)
        if (!info || info === 'invalid') {
          return { getResponseCode: () => 400, getContentText: () => JSON.stringify({ error: 'invalid_token' }) }
        }
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(info) }
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => ({ setMimeType: () => ({ getContent: () => text }) }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_alg: string, text: string) => {
        const digest = createHash('sha256').update(text, 'utf8').digest()
        return Array.from(digest).map((b) => (b > 127 ? b - 256 : b))
      },
      sleep: () => {},
    },
    Logger: { log: () => {} },
    console,
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

  const backend: Backend = {
    handle: (envelope) => handleRequest(typeof envelope === 'string' ? envelope : JSON.stringify(envelope)),
    spreadsheet,
    props,
    cache,
    lock,
    tokens,
    get fetchCalls() {
      return state.fetchCalls
    },
    setup: () => (ctx.setupSpreadsheet as () => void)(),
    ctx,
  }
  backend.setup()
  return backend
}

/** Register a valid Google ID token for `email` and return it. */
export function issueToken(backend: Backend, email = OWNER, overrides: Partial<TokenInfo> = {}): string {
  const token = `tok.${Math.random().toString(36).slice(2)}.${Date.now()}`
  backend.tokens.set(token, {
    aud: CLIENT_ID,
    iss: 'https://accounts.google.com',
    email,
    email_verified: 'true',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  })
  return token
}

export function request(backend: Backend, action: string, payload: unknown = {}, idToken?: string) {
  return backend.handle({ action, payload, idToken: idToken ?? issueToken(backend) })
}

export const sampleBook = {
  isbn: '978-0-7352-1129-2',
  title: 'Atomic Habits',
  author: 'James Clear',
  genre: 'Self Help',
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
