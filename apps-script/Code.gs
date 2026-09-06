/**
 * Spine API — HTTP entry points and request routing.
 *
 * Request envelope (POST body, text/plain, JSON):
 *   { "action": "getBooks", "payload": { ... }, "idToken": "<Google ID token>" }
 *
 * Response envelope:
 *   { "ok": true,  "data": ... }
 *   { "ok": false, "error": { "code": "...", "message": "...", "details": {...} } }
 */

/** Action → handler. Nothing outside this table is reachable from the network. */
function actionHandlers_() {
  return {
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

    // Authenticate before touching any data.
    var email = authenticate_(envelope.idToken);
    enforceRateLimit_(email);

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
