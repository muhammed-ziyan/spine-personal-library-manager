/**
 * Abuse protection, digests and cell sanitisation.
 *
 * Who may call what is decided in Auth.gs: the deployment URL is public (it
 * ships in the front-end bundle), so a signed session token is what grants
 * access, not the address.
 *
 * CORS: Apps Script always answers with `Access-Control-Allow-Origin: *` and
 * cannot handle pre-flight requests. We cannot narrow that header, so we
 * compensate with the token check, a body-size cap and rate limiting.
 */

/** Thrown for any request that should be rejected with a specific API code. */
function apiError_(code, message, details) {
  var err = new Error(message);
  err.apiCode = code;
  err.details = details;
  return err;
}

/** Constant-time string comparison over fixed-length digests. */
function safeEqual_(a, b) {
  var ha = sha256Hex_(a);
  var hb = sha256Hex_(b);
  var diff = 0;
  for (var i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

/** Simple fixed-window rate limit for the whole deployment (one person, one library). */
function enforceRateLimit_() {
  var cache = CacheService.getScriptCache();
  var minute = Math.floor(Date.now() / 60000);
  var key = 'rl:' + minute;
  var count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), 90);
  if (count > LIMITS.rateLimitPerMinute) {
    throw apiError_('RATE_LIMITED', 'Too many requests. Please wait a moment.');
  }
}

/** Apps Script digests come back as signed bytes; render them as lower-case hex. */
function bytesToHex_(bytes) {
  return bytes.map(function (b) {
    var v = (b + 256) % 256;
    return (v < 16 ? '0' : '') + v.toString(16);
  }).join('');
}

function sha256Hex_(text) {
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
}

/** HMAC-SHA256 of `value` under the current session signing key (see Auth.gs). */
function hmacHex_(value) {
  return bytesToHex_(Utilities.computeHmacSha256Signature(value, signingKey_()));
}

/* ───────────── Formula-injection protection ───────────── */

/**
 * Characters that make Sheets interpret a cell as a formula (or otherwise
 * special). A leading apostrophe forces text; a legitimate leading apostrophe
 * is therefore doubled so it round-trips.
 */
var FORMULA_TRIGGER = /^[=+\-@'\t\r\n]/;

function escapeCellText_(text) {
  if (typeof text !== 'string' || text === '') return '';
  return FORMULA_TRIGGER.test(text) ? "'" + text : text;
}

/**
 * Reverse of escapeCellText_. Sheets strips the single leading apostrophe it
 * treats as a text prefix, but we also handle the raw form defensively.
 */
function unescapeCellText_(text) {
  if (typeof text !== 'string') return '';
  if (text.length > 1 && text.charAt(0) === "'" && FORMULA_TRIGGER.test(text.slice(1))) {
    return text.slice(1);
  }
  return text;
}

/** Strip control characters (except newlines in multi-line fields) and trim. */
function cleanString_(value, allowNewlines) {
  if (value === null || value === undefined) return '';
  var s = String(value);
  // Drop C0 control characters and DEL; keep LF/CR in multi-line fields.
  s = allowNewlines
    ? s.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, '')
    : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  return s.replace(/\s+$/g, '').replace(/^\s+/g, '');
}
