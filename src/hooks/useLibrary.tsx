/**
 * Library state: a small cache of the user's books, genres and stats plus the
 * mutations that keep it in sync with the backend. Components never call the
 * API directly — they go through this hook.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, toApiError } from '@/services/api'
import type { AddBookParams, Book, BookPatch, BookStatus, Genre, LibraryStats } from '@/types'
import { useAuth } from './useAuth'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

interface LibraryContextValue {
  books: Book[]
  genres: Genre[]
  stats: LibraryStats | null
  state: LoadState
  error: ApiError | null
  /** Wall-clock time of the last successful full sync, for "Synced 2 min ago". */
  lastSyncedAt: number | null
  refresh: () => Promise<void>
  getBook: (id: string) => Book | undefined
  fetchBook: (id: string) => Promise<Book>
  addBook: (params: AddBookParams) => Promise<Book>
  updateBook: (id: string, patch: BookPatch) => Promise<Book>
  deleteBook: (id: string) => Promise<void>
  changeStatus: (id: string, status: BookStatus) => Promise<Book>
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

function sortByDateAddedDesc(books: Book[]): Book[] {
  return [...books].sort((a, b) => (a.dateAdded < b.dateAdded ? 1 : a.dateAdded > b.dateAdded ? -1 : 0))
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [state, setState] = useState<LoadState>('idle')
  const [error, setError] = useState<ApiError | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const requestId = useRef(0)

  const refreshStats = useCallback(async () => {
    try {
      setStats(await api.getStats())
    } catch {
      /* stats are non-critical; keep the previous snapshot */
    }
  }, [])

  const refresh = useCallback(async () => {
    const id = ++requestId.current
    setState('loading')
    setError(null)
    try {
      const [booksResult, genresResult, statsResult] = await Promise.all([api.getBooks(), api.getGenres(), api.getStats()])
      if (id !== requestId.current) return
      setBooks(sortByDateAddedDesc(booksResult.books))
      setGenres(genresResult)
      setStats(statsResult)
      setLastSyncedAt(Date.now())
      setState('ready')
    } catch (err) {
      if (id !== requestId.current) return
      setError(toApiError(err))
      setState('error')
    }
  }, [])

  useEffect(() => {
    if (authStatus === 'signed-in') void refresh()
    if (authStatus === 'signed-out') {
      setBooks([])
      setStats(null)
      setState('idle')
    }
  }, [authStatus, refresh])

  const getBook = useCallback((id: string) => books.find((book) => book.id === id), [books])

  const fetchBook = useCallback(async (id: string) => {
    const book = await api.getBook(id)
    setBooks((current) => {
      const exists = current.some((b) => b.id === book.id)
      return exists ? current.map((b) => (b.id === book.id ? book : b)) : sortByDateAddedDesc([book, ...current])
    })
    return book
  }, [])

  const addBook = useCallback(
    async (params: AddBookParams) => {
      const book = await api.addBook(params)
      setBooks((current) => sortByDateAddedDesc([book, ...current.filter((b) => b.id !== book.id)]))
      void refreshStats()
      return book
    },
    [refreshStats],
  )

  const updateBook = useCallback(
    async (id: string, patch: BookPatch) => {
      const book = await api.updateBook({ id, patch })
      setBooks((current) => current.map((b) => (b.id === id ? book : b)))
      void refreshStats()
      return book
    },
    [refreshStats],
  )

  const deleteBook = useCallback(
    async (id: string) => {
      await api.deleteBook(id)
      setBooks((current) => current.filter((b) => b.id !== id))
      void refreshStats()
    },
    [refreshStats],
  )

  const changeStatus = useCallback(
    async (id: string, status: BookStatus) => {
      // Optimistic: reflect immediately, roll back on failure.
      let previous: Book | undefined
      setBooks((current) =>
        current.map((b) => {
          if (b.id !== id) return b
          previous = b
          return { ...b, status }
        }),
      )
      try {
        const book = await api.changeStatus({ id, status })
        setBooks((current) => current.map((b) => (b.id === id ? book : b)))
        void refreshStats()
        return book
      } catch (err) {
        if (previous) {
          const restore = previous
          setBooks((current) => current.map((b) => (b.id === id ? restore : b)))
        }
        throw err
      }
    },
    [refreshStats],
  )

  const value = useMemo<LibraryContextValue>(
    () => ({ books, genres, stats, state, error, lastSyncedAt, refresh, getBook, fetchBook, addBook, updateBook, deleteBook, changeStatus }),
    [books, genres, stats, state, error, lastSyncedAt, refresh, getBook, fetchBook, addBook, updateBook, deleteBook, changeStatus],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider')
  return ctx
}
