/**
 * Centralised sheet schema. All column access goes through this file so that
 * reordering or renaming columns in the spreadsheet is a one-line change here.
 */

var SHEETS = {
  BOOKS: 'Books',
  GENRES: 'Genres',
  SETTINGS: 'Settings',
  HISTORY: 'Reading History',
};

/**
 * Books columns in sheet order. `key` is the API field name, `header` is the
 * human-readable header row, `type` drives (de)serialisation.
 */
var BOOK_COLUMNS = [
  { key: 'id', header: 'Book ID', type: 'string' },
  { key: 'isbn', header: 'ISBN', type: 'string' },
  { key: 'title', header: 'Title', type: 'string' },
  { key: 'author', header: 'Author', type: 'string' },
  { key: 'genre', header: 'Genre', type: 'string' },
  { key: 'language', header: 'Language', type: 'string' },
  { key: 'publisher', header: 'Publisher', type: 'string' },
  { key: 'publicationYear', header: 'Publication Year', type: 'number' },
  { key: 'edition', header: 'Edition', type: 'string' },
  { key: 'pages', header: 'Pages', type: 'number' },
  { key: 'format', header: 'Format', type: 'string' },
  { key: 'status', header: 'Status', type: 'string' },
  { key: 'rating', header: 'Rating', type: 'number' },
  { key: 'dateAdded', header: 'Date Added', type: 'date' },
  { key: 'dateStarted', header: 'Date Started', type: 'date' },
  { key: 'dateFinished', header: 'Date Finished', type: 'date' },
  { key: 'notes', header: 'Notes', type: 'string' },
  { key: 'coverUrl', header: 'Cover URL', type: 'string' },
  { key: 'updatedAt', header: 'Updated At', type: 'date' },
];

var GENRE_COLUMNS = [{ key: 'name', header: 'Genre', type: 'string' }];

var SETTINGS_COLUMNS = [
  { key: 'key', header: 'Key', type: 'string' },
  { key: 'value', header: 'Value', type: 'string' },
];

var HISTORY_COLUMNS = [
  { key: 'bookId', header: 'Book ID', type: 'string' },
  { key: 'previousStatus', header: 'Previous Status', type: 'string' },
  { key: 'newStatus', header: 'New Status', type: 'string' },
  { key: 'changedAt', header: 'Changed At', type: 'date' },
];

/** Fields the client may set on create/update. Everything else is server-owned. */
var BOOK_WRITABLE_FIELDS = [
  'isbn', 'title', 'author', 'genre', 'language', 'publisher', 'publicationYear',
  'edition', 'pages', 'format', 'status', 'rating', 'notes', 'coverUrl',
];

/** 1-based column index for a key. */
function bookCol_(key) {
  for (var i = 0; i < BOOK_COLUMNS.length; i++) {
    if (BOOK_COLUMNS[i].key === key) return i + 1;
  }
  throw new Error('Unknown book column: ' + key);
}

function headersFor_(columns) {
  return columns.map(function (c) { return c.header; });
}

/** Convert a raw sheet row into a Book object. */
function rowToBook_(row) {
  var book = {};
  for (var i = 0; i < BOOK_COLUMNS.length; i++) {
    var col = BOOK_COLUMNS[i];
    book[col.key] = fromCell_(row[i], col.type);
  }
  // Normalise server-owned nullable fields to the API contract.
  if (!book.dateStarted) book.dateStarted = null;
  if (!book.dateFinished) book.dateFinished = null;
  if (book.rating === null || book.rating < 1 || book.rating > 5) book.rating = null;
  if (book.publicationYear === null) book.publicationYear = null;
  if (book.pages === null) book.pages = null;
  return book;
}

/** Convert a Book object into a raw sheet row (with formula-safe strings). */
function bookToRow_(book) {
  return BOOK_COLUMNS.map(function (col) {
    return toCell_(book[col.key], col.type);
  });
}

function fromCell_(value, type) {
  if (value === '' || value === null || value === undefined) {
    return type === 'string' ? '' : null;
  }
  switch (type) {
    case 'number': {
      var n = typeof value === 'number' ? value : Number(String(value).trim());
      return isFinite(n) ? n : null;
    }
    case 'date': {
      if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString();
      var d = new Date(String(value));
      return isNaN(d.getTime()) ? String(value) : d.toISOString();
    }
    default:
      return unescapeCellText_(String(value));
  }
}

function toCell_(value, type) {
  if (value === null || value === undefined) return '';
  switch (type) {
    case 'number':
      return typeof value === 'number' && isFinite(value) ? value : '';
    case 'date':
      return value ? String(value) : '';
    default:
      return escapeCellText_(String(value));
  }
}
