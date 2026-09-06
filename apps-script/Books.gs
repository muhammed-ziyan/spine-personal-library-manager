/**
 * Books data-access layer. This is the only file that reads/writes the Books
 * and Reading History sheets. Everything above it works with Book objects.
 */

/** Read all book rows once. Returns [{ row: <sheet row number>, book }]. */
function readAllBooks_() {
  var sheet = getSheet_(SHEETS.BOOKS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, BOOK_COLUMNS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[bookCol_('id') - 1]) continue; // skip blank rows
    out.push({ row: i + 2, book: rowToBook_(row) });
  }
  return out;
}

/** Read a single column (1-based) for all data rows — cheap duplicate/ID scans. */
function readBookColumn_(key) {
  var sheet = getSheet_(SHEETS.BOOKS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, bookCol_(key), lastRow - 1, 1).getValues().map(function (r) { return String(r[0] || ''); });
}

function findBookRow_(id) {
  var ids = readBookColumn_('id');
  for (var i = 0; i < ids.length; i++) {
    if (ids[i] === id) return i + 2;
  }
  return -1;
}

function readBookAtRow_(row) {
  var sheet = getSheet_(SHEETS.BOOKS);
  var values = sheet.getRange(row, 1, 1, BOOK_COLUMNS.length).getValues()[0];
  return rowToBook_(values);
}

function writeBookAtRow_(row, book) {
  var sheet = getSheet_(SHEETS.BOOKS);
  sheet.getRange(row, 1, 1, BOOK_COLUMNS.length).setValues([bookToRow_(book)]);
}

/** Copies sharing an ISBN, or null. */
function findCopiesByIsbn_(isbn) {
  if (!isbn) return null;
  var all = readAllBooks_();
  var copies = all.filter(function (entry) { return entry.book.isbn === isbn; }).map(function (e) { return e.book; });
  if (copies.length === 0) return null;
  return { isbn: isbn, title: copies[0].title, author: copies[0].author, copies: copies };
}

/* ───────────── API operations ───────────── */

function getBooks_(params) {
  var q = validateQueryParams_(params);
  var books = readAllBooks_().map(function (e) { return e.book; });

  if (q.status) books = books.filter(function (b) { return b.status === q.status; });
  if (q.genre) books = books.filter(function (b) { return b.genre === q.genre; });
  if (q.language) books = books.filter(function (b) { return b.language === q.language; });
  if (q.query) books = filterByQuery_(books, q.query);

  var sort = q.sort || 'dateAdded';
  var direction = q.direction || (sort === 'dateAdded' || sort === 'rating' ? 'desc' : 'asc');
  books.sort(function (a, b) {
    var order = compareBooks_(a, b, sort);
    return direction === 'asc' ? order : -order;
  });

  var total = books.length;
  var offset = q.offset || 0;
  var limit = q.limit || total;
  return { books: books.slice(offset, offset + limit), total: total };
}

function filterByQuery_(books, query) {
  var needle = query.toLowerCase();
  var isbnNeedle = normalizeIsbn_(query);
  return books.filter(function (b) {
    if (b.title.toLowerCase().indexOf(needle) !== -1) return true;
    if (b.author.toLowerCase().indexOf(needle) !== -1) return true;
    return isbnNeedle.length >= 4 && b.isbn.indexOf(isbnNeedle) !== -1;
  });
}

function compareBooks_(a, b, sort) {
  switch (sort) {
    case 'title': return a.title.localeCompare(b.title);
    case 'author': return a.author.localeCompare(b.author) || a.title.localeCompare(b.title);
    case 'rating': return (a.rating || 0) - (b.rating || 0) || a.title.localeCompare(b.title);
    default: return a.dateAdded < b.dateAdded ? -1 : a.dateAdded > b.dateAdded ? 1 : 0;
  }
}

function getBook_(payload) {
  var id = validateBookId_(payload && payload.id);
  var row = findBookRow_(id);
  if (row === -1) throw apiError_('NOT_FOUND', 'Book not found.');
  return readBookAtRow_(row);
}

function searchBooks_(payload) {
  var query = payload && typeof payload.query === 'string' ? payload.query : '';
  return getBooks_({ query: query }).books;
}

function checkIsbn_(payload) {
  var parsed = canonicalIsbn_(payload && payload.isbn);
  if (!parsed.valid) throw apiError_('VALIDATION', 'Not a valid ISBN.', { isbn: 'Not a valid ISBN-10 or ISBN-13.' });
  return { isbn: parsed.isbn, duplicate: findCopiesByIsbn_(parsed.isbn) };
}

/**
 * Create a physical copy. Duplicate detection and ID generation happen inside
 * the script lock so two simultaneous adds can't both slip past the check.
 */
function addBook_(payload) {
  var result = validateBookInput_(payload);
  if (!result.value) throw apiError_('VALIDATION', firstError_(result.errors), result.errors);
  var input = result.value;
  var allowDuplicate = payload.allowDuplicate === true;

  return withLock_(function () {
    if (input.isbn && !allowDuplicate) {
      var duplicate = findCopiesByIsbn_(input.isbn);
      if (duplicate) throw apiError_('DUPLICATE', 'You already have this book.', { duplicate: duplicate });
    }

    var now = nowIso_();
    var book = {
      id: nextBookId_(readBookColumn_('id')),
      isbn: input.isbn,
      title: input.title,
      author: input.author,
      genre: input.genre,
      language: input.language,
      publisher: input.publisher,
      publicationYear: input.publicationYear,
      edition: input.edition,
      pages: input.pages,
      format: input.format,
      status: input.status,
      rating: input.rating,
      dateAdded: now,
      dateStarted: input.status === 'Reading' ? now : null,
      dateFinished: input.status === 'Read' ? now : null,
      notes: input.notes,
      coverUrl: input.coverUrl,
      updatedAt: now,
    };

    getSheet_(SHEETS.BOOKS).appendRow(bookToRow_(book));
    if (book.status !== 'Unread') recordHistory_(book.id, '', book.status, now);
    return book;
  });
}

function updateBook_(payload) {
  var id = validateBookId_(payload && payload.id);
  var result = validateBookPatch_(payload && payload.patch);
  if (!result.value) throw apiError_('VALIDATION', firstError_(result.errors), result.errors);
  var patch = result.value;

  return withLock_(function () {
    var row = findBookRow_(id);
    if (row === -1) throw apiError_('NOT_FOUND', 'Book not found.');
    var book = readBookAtRow_(row);
    var previousStatus = book.status;
    var now = nowIso_();

    Object.keys(patch).forEach(function (key) { book[key] = patch[key]; });
    book.id = id; // immutable
    book.updatedAt = now;
    applyStatusDates_(book, previousStatus, now);

    writeBookAtRow_(row, book);
    if (patch.status && patch.status !== previousStatus) recordHistory_(id, previousStatus, patch.status, now);
    return book;
  });
}

function changeStatus_(payload) {
  var id = validateBookId_(payload && payload.id);
  var status = validateStatus_(payload && payload.status);
  return updateBook_({ id: id, patch: { status: status } });
}

function deleteBook_(payload) {
  var id = validateBookId_(payload && payload.id);
  return withLock_(function () {
    var row = findBookRow_(id);
    if (row === -1) throw apiError_('NOT_FOUND', 'Book not found.');
    getSheet_(SHEETS.BOOKS).deleteRow(row);
    return null;
  });
}

/** Keep Date Started / Date Finished in step with status transitions. */
function applyStatusDates_(book, previousStatus, now) {
  if (book.status === previousStatus) return;
  if (book.status === 'Reading' && !book.dateStarted) book.dateStarted = now;
  if (book.status === 'Read') {
    if (!book.dateStarted) book.dateStarted = now;
    book.dateFinished = now;
  }
  if (book.status === 'Unread') {
    book.dateStarted = null;
    book.dateFinished = null;
  }
}

function recordHistory_(bookId, previousStatus, newStatus, changedAt) {
  try {
    var sheet = getSpreadsheet_().getSheetByName(SHEETS.HISTORY);
    if (!sheet) return;
    sheet.appendRow([bookId, previousStatus, newStatus, changedAt]);
  } catch (e) {
    Logger.log('recordHistory_ failed: ' + (e && e.message));
  }
}

function firstError_(errors) {
  var keys = Object.keys(errors || {});
  if (!keys.length) return 'Please check the details and try again.';
  var key = keys[0];
  return key === '_' ? errors[key] : humanField_(key) + ': ' + errors[key];
}

function humanField_(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); });
}
