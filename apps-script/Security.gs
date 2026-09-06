/**
 * Access control, abuse protection and cell sanitisation.
 *
 * Trust model
 * ───────────
 * Spine is a personal app: one deployment serves one spreadsheet, and the
 * person who owns the sheet deploys the script themselves. There is no
 * sign-in. The web app is deployed as "execute as me / anyone", which is the
 * only deployment shape a cross-origin PWA can call, so the deployment URL is
 * what grants access — treat it like a password.
 *
 * Optionally the owner sets an ACCESS_KEY Script Property. When present, every
 * request must carry the same value in its `key` field; that lets a leaked URL
 * be locked out again without redeploying.
 *
 * CORS: Apps Script always answers with `Access-Control-Allow-Origin: *` and
 * cannot handle pre-flight requests. We cannot narrow that header, so we
 * compensate with the key check above, a body-size cap and rate limiting.
 */

/** Thrown for any request that should be rejected with a specific API code. */
function apiError_(code, message, details) {
  var err = new Error(message);
  err.apiCode = code;
  err.details = details;
  return err;
}

/**
 * Check the optional access key on a request envelope.
 * Throws UNAUTHORIZED when a key is configured and the request's key does not match.
 */
function authorize_(envelope) {
  var expected = getAccessKey_();
  if (!expected) return;
  var supplied = envelope.key;
  if (typeof supplied !== 'string' || supplied.length === 0 || supplied.length > LIMITS.accessKeyMax) {
    throw apiError_('UNAUTHORIZED', 'This library needs an access key.');
  }
  if (!safeEqual_(supplied, expected)) {
    throw apiError_('UNAUTHORIZED', 'The access key is not right for this library.');
  }
}

/** Constant-time string comparison over fixed-length digests. */
function safeEqual_(a, b) {
  var ha = sha256Hex_(a);
  var hb = sha256Hex_(b);
  var diff = 0;
  for (var i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

/** Simple fixed-window rate limit for the whole deployment (there is no per-user identity). */
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

function sha256Hex_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var v = (b + 256) % 256;
    return (v < 16 ? '0' : '') + v.toString(16);
  }).join('');
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
