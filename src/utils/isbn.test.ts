import { describe, expect, it } from 'vitest'
import { formatIsbn, isBooklandEan, isbn10To13, isValidIsbn10, isValidIsbn13, normalizeIsbn, parseIsbn } from './isbn'

describe('normalizeIsbn', () => {
  it('strips hyphens, spaces and prefixes', () => {
    expect(normalizeIsbn('978-0-7352-1129-2')).toBe('9780735211292')
    expect(normalizeIsbn(' 978 0735 211292 ')).toBe('9780735211292')
    expect(normalizeIsbn('ISBN-13: 978-0735211292')).toBe('9780735211292')
    expect(normalizeIsbn('isbn 0-7352-1129-9')).toBe('0735211299')
  })

  it('upper-cases the ISBN-10 check digit', () => {
    expect(normalizeIsbn('0-8044-2957-x')).toBe('080442957X')
  })

  it('returns an empty string for missing input', () => {
    expect(normalizeIsbn('')).toBe('')
    expect(normalizeIsbn(null)).toBe('')
    expect(normalizeIsbn(undefined)).toBe('')
  })
})

describe('ISBN-10', () => {
  it('validates check digits', () => {
    expect(isValidIsbn10('0735211299')).toBe(true)
    expect(isValidIsbn10('080442957X')).toBe(true)
    expect(isValidIsbn10('0735211298')).toBe(false)
    expect(isValidIsbn10('073521129')).toBe(false)
  })

  it('converts to ISBN-13', () => {
    expect(isbn10To13('0735211299')).toBe('9780735211292')
    expect(isbn10To13('0306406152')).toBe('9780306406157')
  })
})

describe('ISBN-13', () => {
  it('validates check digits', () => {
    expect(isValidIsbn13('9780735211292')).toBe(true)
    expect(isValidIsbn13('9780141036144')).toBe(true)
    expect(isValidIsbn13('9780735211293')).toBe(false)
    expect(isValidIsbn13('978073521129')).toBe(false)
    expect(isValidIsbn13('97807352112921')).toBe(false)
  })
})

describe('parseIsbn', () => {
  it('parses ISBN-13', () => {
    expect(parseIsbn('978-0-7352-1129-2')).toEqual({ isbn: '9780735211292', valid: true, kind: 'isbn13' })
  })

  it('parses ISBN-10', () => {
    expect(parseIsbn('0-7352-1129-9')).toEqual({ isbn: '0735211299', valid: true, kind: 'isbn10' })
  })

  it('parses formatted input from a barcode scanner', () => {
    expect(parseIsbn('9780735211292').valid).toBe(true)
  })

  it('flags invalid input', () => {
    expect(parseIsbn('1234567890123')).toMatchObject({ valid: false, kind: 'invalid' })
    expect(parseIsbn('hello')).toMatchObject({ valid: false, kind: 'invalid' })
    expect(parseIsbn('12345')).toMatchObject({ valid: false, kind: 'invalid' })
  })

  it('flags missing input as empty rather than invalid', () => {
    expect(parseIsbn('')).toEqual({ isbn: '', valid: false, kind: 'empty' })
    expect(parseIsbn('  ')).toEqual({ isbn: '', valid: false, kind: 'empty' })
  })
})

describe('isBooklandEan', () => {
  it('accepts 978/979 prefixes only', () => {
    expect(isBooklandEan('9780735211292')).toBe(true)
    expect(isBooklandEan('9791234567896')).toBe(true)
    expect(isBooklandEan('5012345678900')).toBe(false)
    expect(isBooklandEan('0735211299')).toBe(false)
  })
})

describe('formatIsbn', () => {
  it('hyphenates for display', () => {
    expect(formatIsbn('9780735211292')).toBe('978-0-73521-129-2')
    expect(formatIsbn('0735211299')).toBe('0-7352-1129-9')
    expect(formatIsbn('')).toBe('')
  })
})
