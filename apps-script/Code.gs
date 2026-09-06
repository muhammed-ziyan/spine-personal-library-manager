/**
 * Spine API — HTTP entry points and request routing.
 *
 * Request envelope (POST body, text/plain, JSON):
 *   { "action": "getBooks", "payload": { ... }, "key": "<access key, only if the owner set one>" }
 *
 * Response envelope:
 *   { "ok": true,  "data": ... }
 *   { "ok": false, "error": { "code": "...", "message": "...", "details": {...} } }
 */

/** Action → handler. Nothing outside this table is reachable from the network. */
function actionHandlers_() {
  return {
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
      return failure_('BAD_REQUEST', 'Unknown action.');
    }

    // Check the optional access key before touching any data.
    authorize_(envelope);
    enforceRateLimit_();

    var payload = envelope.payload === undefined ? {} : envelope.payload;
    if (!isPlainObject_(payload)) return failure_('BAD_REQUEST', 'Malformed payload.');

    var data = handlers[action](payload);
    return { ok: true, data: data === undefined ? null : data };
  } catch (err) {
    if (err && err.apiCode) {
      return failure_(err.apiCode, err.message, err.details);
    }
    // Unexpected failure: log the detail server-side, never return it.
    Logger.log('Unhandled error: ' + (err && err.stack ? err.stack : err));
    return failure_('SERVER_ERROR', 'Something went wrong. Please try again.');
  }
}

function failure_(code, message, details) {
  var error = { code: code, message: message };
  if (details) error.details = details;
  return { ok: false, error: error };
}

/**
 * Connection check used by the app when a library is first connected: confirms
 * the URL (and access key, if any) reach a Spine backend and names the sheet.
 */
function ping_() {
  return {
    version: SPINE_VERSION,
    library: getSpreadsheet_().getName(),
    books: readBookColumn_('id').length,
  };
}
