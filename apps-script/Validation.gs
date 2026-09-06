/**
 * Server-side validation. Every mutation passes through here; the client's
 * validation is only a convenience and is never trusted.
 *
 * Validators return a { value, errors } pair where `value` is the cleaned,
 * typed input and `errors` maps field → message.
 */

function isPlainObject_(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateString_(errors, out, input, key, max, required, allowNewlines) {
  var raw = input[key];
  if (raw !== undefined && raw !== null && typeof raw !== 'string' && typeof raw !== 'number') {
    errors[key] = 'Must be text.';
    return;
  }
  var value = cleanString_(raw === undefined || raw === null ? '' : raw, allowNewlines);
  if (required && !value) {
    errors[key] = 'Required.';
    return;
  }
  if (value.length > max) {
    errors[key] = 'Must be ' + max + ' characters or fewer.';
    return;
  }
  out[key] = value;
}

function validateInteger_(errors, out, input, key, min, max, message) {
  var raw = input[key];
  if (raw === undefined || raw === null || raw === '') {
    out[key] = null;
    return;
  }
  var n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!isFinite(n) || Math.floor(n) !== n || n < min || n > max) {
    errors[key] = message;
    return;
  }
  out[key] = n;
}

/**
 * Validate a full book payload for addBook.
 * Applies defaults: status Unread, rating null.
 */
function validateBookInput_(input) {
  var errors = {};
  var out = {};
  if (!isPlainObject_(input)) return { value: null, errors: { _: 'Malformed request.' } };

  validateString_(errors, out, input, 'title', LIMITS.title, true, false);
  validateString_(errors, out, input, 'author', LIMITS.author, true, false);
  validateString_(errors, out, input, 'genre', LIMITS.genre, false, false);
  validateString_(errors, out, input, 'subgenre', LIMITS.subgenre, false, false);
  validateString_(errors, out, input, 'language', LIMITS.language, false, false);
  validateString_(errors, out, input, 'publisher', LIMITS.publisher, false, false);
  validateString_(errors, out, input, 'edition', LIMITS.edition, false, false);
  validateString_(errors, out, input, 'format', LIMITS.format, false, false);
  validateString_(errors, out, input, 'notes', LIMITS.notes, false, true);
  validateString_(errors, out, input, 'coverUrl', LIMITS.coverUrl, false, false);

  if (out.coverUrl && !/^https:\/\/[^\s]+$/i.test(out.coverUrl)) {
    errors.coverUrl = 'Cover must be an https:// link.';
  }

  // ISBN — optional, but must be valid when present. Stored canonically as ISBN-13.
  var isbnRaw = input.isbn;
  if (isbnRaw === undefined || isbnRaw === null || String(isbnRaw).trim() === '') {
    out.isbn = '';
  } else if (typeof isbnRaw !== 'string' && typeof isbnRaw !== 'number') {
    errors.isbn = 'Must be text.';
  } else {
    var parsed = canonicalIsbn_(String(isbnRaw));
    if (!parsed.valid) errors.isbn = 'Not a valid ISBN-10 or ISBN-13.';
    else out.isbn = parsed.isbn;
  }

  // Status — default Unread.
  var status = input.status === undefined || input.status === null || input.status === '' ? 'Unread' : input.status;
  if (typeof status !== 'string' || BOOK_STATUSES.indexOf(status) === -1) errors.status = 'Invalid status.';
  else out.status = status;

  // Rating — optional 1–5.
  validateInteger_(errors, out, input, 'rating', 1, 5, 'Rating must be a whole number from 1 to 5.');

  var maxYear = new Date().getFullYear() + 1;
  validateInteger_(errors, out, input, 'publicationYear', LIMITS.yearMin, maxYear, 'Publication year must be between ' + LIMITS.yearMin + ' and ' + maxYear + '.');
  validateInteger_(errors, out, input, 'pages', 1, LIMITS.pagesMax, 'Pages must be a positive whole number.');

  return { value: Object.keys(errors).length ? null : out, errors: errors };
}

/**
 * Validate a partial update. Only whitelisted fields are accepted; any
 * unknown key is rejected outright so clients can't poke at server-owned data.
 */
function validateBookPatch_(patch) {
  if (!isPlainObject_(patch)) return { value: null, errors: { _: 'Malformed request.' } };
  var keys = Object.keys(patch);
  if (keys.length === 0) return { value: null, errors: { _: 'Nothing to update.' } };
  for (var i = 0; i < keys.length; i++) {
    if (BOOK_WRITABLE_FIELDS.indexOf(keys[i]) === -1) {
      return { value: null, errors: { _: 'Field "' + keys[i] + '" cannot be changed.' } };
    }
  }
  // Validate as a full object using placeholders for missing required fields,
  // then keep only the supplied keys.
  var merged = {};
  keys.forEach(function (k) { merged[k] = patch[k]; });
  if (patch.title === undefined) merged.title = 'placeholder';
  if (patch.author === undefined) merged.author = 'placeholder';
  var result = validateBookInput_(merged);
  var errors = {};
  keys.forEach(function (k) { if (result.errors[k]) errors[k] = result.errors[k]; });
  if (Object.keys(errors).length) return { value: null, errors: errors };
  var out = {};
  keys.forEach(function (k) { out[k] = result.value[k]; });
  return { value: out, errors: {} };
}

function validateBookId_(id) {
  if (typeof id !== 'string' || !/^BK-\d{5,}$/.test(id)) {
    throw apiError_('BAD_REQUEST', 'Invalid book ID.');
  }
  return id;
}

function validateStatus_(status) {
  if (typeof status !== 'string' || BOOK_STATUSES.indexOf(status) === -1) {
    throw apiError_('VALIDATION', 'Invalid status.', { status: 'Invalid status.' });
  }
  return status;
}

function validateQueryParams_(params) {
  var out = {};
  if (!isPlainObject_(params)) return out;
  if (typeof params.query === 'string') out.query = cleanString_(params.query, false).slice(0, 200);
  if (typeof params.status === 'string' && BOOK_STATUSES.indexOf(params.status) !== -1) out.status = params.status;
  if (typeof params.genre === 'string') out.genre = cleanString_(params.genre, false).slice(0, LIMITS.genre);
  if (typeof params.language === 'string') out.language = cleanString_(params.language, false).slice(0, LIMITS.language);
  if (['title', 'author', 'dateAdded', 'rating'].indexOf(params.sort) !== -1) out.sort = params.sort;
  if (params.direction === 'asc' || params.direction === 'desc') out.direction = params.direction;
  var limit = Number(params.limit);
  if (isFinite(limit) && limit > 0) out.limit = Math.min(Math.floor(limit), LIMITS.pageMax);
  var offset = Number(params.offset);
  if (isFinite(offset) && offset >= 0) out.offset = Math.floor(offset);
  return out;
}
