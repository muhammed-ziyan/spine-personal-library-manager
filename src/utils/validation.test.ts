import { describe, expect, it } from 'vitest'
import { emptyBookInput, hasErrors, validateBookInput } from './validation'

const valid = emptyBookInput({ title: 'The Hobbit', author: 'J.R.R. Tolkien', isbn: '9780261103344', rating: 4 })

describe('validateBookInput', () => {
  it('accepts a valid book', () => {
    expect(validateBookInput(valid)).toEqual({})
  })

  it('accepts a book without an ISBN', () => {
    expect(validateBookInput({ ...valid, isbn: '' })).toEqual({})
  })

  it('requires a title', () => {
    expect(validateBookInput({ ...valid, title: '  ' }).title).toBeDefined()
  })

  it('requires an author', () => {
    expect(validateBookInput({ ...valid, author: '' }).author).toBeDefined()
  })

  it('rejects an invalid rating', () => {
    expect(validateBookInput({ ...valid, rating: 7 as never }).rating).toBeDefined()
    expect(validateBookInput({ ...valid, rating: 0 as never }).rating).toBeDefined()
  })

  it('allows an unrated book', () => {
    expect(validateBookInput({ ...valid, rating: null })).toEqual({})
  })

  it('rejects an invalid status', () => {
    expect(validateBookInput({ ...valid, status: 'Done' as never }).status).toBeDefined()
  })

  it('rejects oversized notes', () => {
    expect(validateBookInput({ ...valid, notes: 'x'.repeat(5001) }).notes).toBeDefined()
    expect(validateBookInput({ ...valid, notes: 'x'.repeat(5000) })).toEqual({})
  })

  it('rejects an invalid ISBN', () => {
    expect(validateBookInput({ ...valid, isbn: '123' }).isbn).toBeDefined()
  })

  it('validates optional numbers', () => {
    expect(validateBookInput({ ...valid, pages: 0 }).pages).toBeDefined()
    expect(validateBookInput({ ...valid, publicationYear: 999 }).publicationYear).toBeDefined()
    expect(validateBookInput({ ...valid, publicationYear: new Date().getFullYear() })).toEqual({})
  })

  it('requires https cover links', () => {
    expect(validateBookInput({ ...valid, coverUrl: 'http://x.example/a.jpg' }).coverUrl).toBeDefined()
    expect(validateBookInput({ ...valid, coverUrl: 'https://x.example/a.jpg' })).toEqual({})
  })

  it('hasErrors reflects the result', () => {
    expect(hasErrors({})).toBe(false)
    expect(hasErrors({ title: 'Required' })).toBe(true)
  })
})
