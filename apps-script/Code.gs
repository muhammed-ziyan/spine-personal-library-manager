/**
 * Spine API — HTTP entry points and request routing.
 *
 * Request envelope (POST body, text/plain, JSON):
 *   { "action": "getBooks", "payload": { ... }, "token": "<session token from login>" }
 *
 * `login` is the only action that needs no token; see Auth.gs.
 *
 * Response envelope:
 *   { "ok": true,  "data": ... }
 *   { "ok": false, "error": { "code": "...", "message": "...", "details": {...} } }
 */

/** Action → handler. Nothing outside this table is reachable from the network. */
function actionHandlers_() {
  return {
    login: login_,
    ping: ping_,
    getBooks: getBooks_,
    getBook: getBook_,
    searchBooks: searchBooks_,
    getGenres: getGenres_,
    getStats: getStats_,
    checkIsbn: checkIsbn_,
    addBook: addBook_,
    updateBook: updateBook_,
    deleteBook: deleteBook_,
    changeStatus: changeStatus_,
  };
}

function doPost(e) {
  var raw = e && e.postData && e.postData.contents;
  console.log('doPost: received ' + (raw ? raw.length + ' bytes' : 'no body'));
  return jsonOutput_(handleRequest_(raw));
}

/** GET is not part of the API; answer with a harmless hint and no data. */
function doGet() {
  return jsonOutput_({ ok: false, error: { code: 'BAD_REQUEST', message: 'Spine API: use POST.' } });
}

/**
 * Pure request handler (also exercised directly by the test-suite).
 * @param {string} rawBody JSON envelope
 * @return {Object} response envelope
 */
function handleRequest_(rawBody) {
  try {
    if (typeof rawBody !== 'string' || !rawBody) return failure_('BAD_REQUEST', 'Empty request.');
    if (rawBody.length > LIMITS.requestBytes) return failure_('BAD_REQUEST', 'Request too large.');

    var envelope;
    try {
      envelope = JSON.parse(rawBody);
    } catch (parseError) {
      return failure_('BAD_REQUEST', 'Malformed request.');
    }
    if (!isPlainObject_(envelope)) return failure_('BAD_REQUEST', 'Malformed request.');

    var handlers = actionHandlers_();
    var action = envelope.action;
    if (typeof action !== 'string' || !handlers.hasOwnProperty(action)) {
      console.warn('handleRequest_: unknown action ' + JSON.stringify(action));
      return failure_('BAD_REQUEST', 'Unknown action.');
    }
    console.log('handleRequest_: action=' + action + ' token=' + (envelope.token ? 'present' : 'absent'));

    // Establish who is calling before touching any data — or any payload.
    var session = authorize_(envelope, action);
    if (session) console.log('handleRequest_: authorised as ' + session.username);
    enforceRateLimit_();

    var payload = envelope.payload === undefined ? {} : envelope.payload;
    if (!isPlainObject_(payload)) return failure_('BAD_REQUEST', 'Malformed payload.');

    var data = handlers[action](payload);
    console.log('handleRequest_: ' + action + ' ok');
    return { ok: true, data: data === undefined ? null : data };
  } catch (err) {
    if (err && err.apiCode) {
      console.warn('handleRequest_: rejected with ' + err.apiCode + ': ' + err.message);
      return failure_(err.apiCode, err.message, err.details);
    }
    // Unexpected failure: log the detail server-side, never return it.
    console.error('handleRequest_: unhandled error: ' + (err && err.stack ? err.stack : err));
    return failure_('SERVER_ERROR', 'Something went wrong. Please try again.');
  }
}

function failure_(code, message, details) {
  var error = { code: code, message: message };
  if (details) error.details = details;
  return { ok: false, error: error };
}

/**
 * Session check, run on every app launch that starts with a stored token: it
 * proves the token is still good and refreshes the library summary. An expired
 * or revoked token fails in authorize_ before this ever runs.
 */
function ping_() {
  console.log('ping_: SPREADSHEET_ID property ' + (getConfigValue_(PROP_KEYS.SPREADSHEET_ID) ? 'set' : 'not set (using bound sheet)'));
  var ss = getSpreadsheet_();
  console.log('ping_: opened spreadsheet "' + ss.getName() + '" (' + ss.getId() + ')');
  var tabs = ss.getSheets().map(function (sheet) { return sheet.getName(); });
  console.log('ping_: tabs present: ' + JSON.stringify(tabs));
  var books = readBookColumn_('id').length;
  console.log('ping_: Books tab has ' + books + ' row(s)');
  return {
    version: SPINE_VERSION,
    library: ss.getName(),
    books: books,
  };
}
