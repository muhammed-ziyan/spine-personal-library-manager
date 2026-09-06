/**
 * ISBN helpers — mirrors src/utils/isbn.ts. Keep both in sync.
 */

function normalizeIsbn_(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .toUpperCase()
    .replace(/^ISBN(?:-1[03])?:?\s*/i, '')
    .replace(/[^0-9X]/g, '');
}

function isValidIsbn10_(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  var sum = 0;
  for (var i = 0; i < 10; i++) {
    var ch = isbn.charAt(i);
    sum += (ch === 'X' ? 10 : Number(ch)) * (10 - i);
  }
  return sum % 11 === 0;
}

function isValidIsbn13_(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  var sum = 0;
  for (var i = 0; i < 12; i++) sum += Number(isbn.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(isbn.charAt(12));
}

/** Returns { isbn, valid, kind }. */
function parseIsbn_(raw) {
  var isbn = normalizeIsbn_(raw);
  if (!isbn) {
    // Blank input is "no ISBN"; non-blank input with no ISBN characters is a bad ISBN.
    var blank = raw === null || raw === undefined || String(raw).replace(/\s+/g, '') === '';
    return { isbn: '', valid: false, kind: blank ? 'empty' : 'invalid' };
  }
  if (isbn.length === 13 && isValidIsbn13_(isbn)) return { isbn: isbn, valid: true, kind: 'isbn13' };
  if (isbn.length === 10 && isValidIsbn10_(isbn)) return { isbn: isbn, valid: true, kind: 'isbn10' };
  return { isbn: isbn, valid: false, kind: 'invalid' };
}

/** ISBN-10 → ISBN-13 so both forms of the same edition match as duplicates. */
function isbn10To13_(isbn10) {
  var core = '978' + isbn10.slice(0, 9);
  var sum = 0;
  for (var i = 0; i < 12; i++) sum += Number(core.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return core + String((10 - (sum % 10)) % 10);
}

/** Canonical stored form: ISBN-13 when derivable, else the normalised input. */
function canonicalIsbn_(raw) {
  var parsed = parseIsbn_(raw);
  if (!parsed.valid) return parsed;
  if (parsed.kind === 'isbn10') return { isbn: isbn10To13_(parsed.isbn), valid: true, kind: 'isbn13' };
  return parsed;
}
