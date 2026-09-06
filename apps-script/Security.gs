/**
 * Authentication, authorisation, abuse protection and cell sanitisation.
 *
 * Trust model
 * ───────────
 * The web app is deployed as "execute as me / anyone", because that is the only
 * deployment shape a cross-origin PWA can call. The URL is therefore NOT a
 * secret and is NOT the access control. Instead every request carries a Google
 * ID token minted by Google Identity Services in the browser. We verify it with
 * Google's tokeninfo endpoint and then check the account against an allow-list.
 *
 * CORS: Apps Script always answers with `Access-Control-Allow-Origin: *` and
 * cannot handle pre-flight requests. We cannot narrow that header, so we
 * compensate with the token check above, a body-size cap and rate limiting.
 */

var GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
var TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';

/** Thrown for any request that should be rejected with a specific API code. */
function apiError_(code, message, details) {
  var err = new Error(message);
  err.apiCode = code;
  err.details = details;
  return err;
}

/**
 * Verify the ID token and return the authenticated email.
 * Throws UNAUTHORIZED (bad/expired token) or FORBIDDEN (valid but not allowed).
 */
function authenticate_(idToken) {
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 4096) {
    throw apiError_('UNAUTHORIZED', 'Sign in to continue.');
  }
  var clientId = getGoogleClientId_();
  var allowed = getAllowedEmails_();
  if (!clientId || allowed.length === 0) {
    // Refuse to run wide open. The deployer must finish configuration.
    throw apiError_('SERVER_ERROR', 'The backend is not fully configured.');
  }

  var cache = CacheService.getScriptCache();
  var cacheKey = 'tok:' + sha256Hex_(idToken);
  var email = cache.get(cacheKey);

  if (!email) {
    var info = fetchTokenInfo_(idToken);
    if (!info) throw apiError_('UNAUTHORIZED', 'Your session has expired. Please sign in again.');
    if (info.aud !== clientId) throw apiError_('UNAUTHORIZED', 'Token was not issued for this app.');
    if (GOOGLE_ISSUERS.indexOf(info.iss) === -1) throw apiError_('UNAUTHORIZED', 'Token issuer is not Google.');
    if (String(info.email_verified) !== 'true') throw apiError_('UNAUTHORIZED', 'Email address is not verified.');
    var exp = Number(info.exp) * 1000;
    var now = Date.now();
    if (!exp || exp <= now) throw apiError_('UNAUTHORIZED', 'Your session has expired. Please sign in again.');
    email = String(info.email || '').toLowerCase();
    if (!email) throw apiError_('UNAUTHORIZED', 'Token has no email.');
    // Cache until shortly before expiry (max 10 min) to avoid a network round trip per request.
    var ttl = Math.max(0, Math.min(600, Math.floor((exp - now) / 1000) - 30));
    if (ttl > 0) cache.put(cacheKey, email, ttl);
  }

  if (allowed.indexOf(email) === -1) {
    throw apiError_('FORBIDDEN', 'This Google account is not allowed to use this library.');
  }
  return email;
}

function fetchTokenInfo_(idToken) {
  try {
    var response = UrlFetchApp.fetch(TOKENINFO_URL + encodeURIComponent(idToken), {
      muteHttpExceptions: true,
      followRedirects: false,
    });
    if (response.getResponseCode() !== 200) return null;
    var info = JSON.parse(response.getContentText());
    return info && typeof info === 'object' ? info : null;
  } catch (e) {
    Logger.log('tokeninfo failed: ' + (e && e.message));
    return null;
  }
}

/** Simple fixed-window rate limit per account. */
function enforceRateLimit_(email) {
  var cache = CacheService.getScriptCache();
  var minute = Math.floor(Date.now() / 60000);
  var key = 'rl:' + sha256Hex_(email) + ':' + minute;
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
