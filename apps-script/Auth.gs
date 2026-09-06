/**
 * Sign-in and session tokens.
 *
 * Trust model
 * ───────────
 * The web app is deployed "execute as me / anyone", which is the only shape a
 * cross-origin PWA can call, so the deployment URL is public by construction:
 * it ships inside the front-end bundle. The URL therefore grants nothing on its
 * own — every action except `login` requires a session token.
 *
 * The username and password live in Script Properties (AUTH_USERNAME,
 * AUTH_PASSWORD) and are only ever compared here, server-side. They are never
 * sent to the browser and never appear in the built front-end.
 *
 * `login` answers with a token of the form
 *
 *   v1|<uriEncoded username>|<issued ms>|<expires ms>|<hmac-sha256 hex>
 *
 * `|` is used as the separator precisely because encodeURIComponent escapes it
 * (%7C), so no username can forge extra fields. The signature covers everything
 * before it, keyed by AUTH_SECRET *mixed with a digest of the current
 * password* — so changing the password silently invalidates every token that
 * was ever issued, and so does rotating the secret (see resetSessions()).
 *
 * Tokens are stateless: no session is stored, nothing to clean up, and a signed
 * token survives the script's frequent cold starts.
 */

var TOKEN_VERSION = 'v1';

/** Actions callable without a token. Everything else needs one. */
function publicActions_() {
  return { login: true };
}

function getAuthUsername_() {
  return getConfigValue_(PROP_KEYS.AUTH_USERNAME);
}

function getAuthPassword_() {
  return getConfigValue_(PROP_KEYS.AUTH_PASSWORD);
}

/** Whether the owner has configured a sign-in. Until they do, the API serves nothing. */
function isSignInConfigured_() {
  return Boolean(getAuthUsername_() && getAuthPassword_());
}

/**
 * The HMAC key for session tokens. Generated on first use so the owner only has
 * to set a username and a password; rotating it signs every device out.
 */
function getAuthSecret_() {
  var props = getScriptProps_();
  var secret = props.getProperty(PROP_KEYS.AUTH_SECRET);
  if (secret && String(secret).length >= 32) return String(secret);
  secret = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty(PROP_KEYS.AUTH_SECRET, secret);
  return secret;
}

/**
 * Signing key = secret ⊕ current password. Binding the password in means a
 * password change expires outstanding tokens without any stored session state.
 */
function signingKey_() {
  return getAuthSecret_() + '|' + sha256Hex_(getAuthPassword_());
}

/* ───────────── login ───────────── */

/**
 * Exchange a username and password for a session token.
 * Also returns the library summary so the app can render without a second call.
 */
function login_(payload) {
  if (!isSignInConfigured_()) {
    throw apiError_('NOT_CONFIGURED', 'This library has no sign-in yet. Set AUTH_USERNAME and AUTH_PASSWORD in the script properties.');
  }

  var username = typeof payload.username === 'string' ? payload.username.trim() : '';
  var password = typeof payload.password === 'string' ? payload.password : '';

  // Reject implausible input before spending a digest on it, but answer with the
  // same message as a wrong password so nothing distinguishes the two.
  if (!username || !password || username.length > LIMITS.usernameMax || password.length > LIMITS.passwordMax) {
    throw apiError_('UNAUTHORIZED', 'That username and password do not match.');
  }

  enforceLoginThrottle_();

  // Both comparisons always run: a wrong username must cost the same as a wrong password.
  var userOk = safeEqual_(username.toLowerCase(), getAuthUsername_().toLowerCase());
  var passOk = safeEqual_(password, getAuthPassword_());
  if (!userOk || !passOk) {
    recordFailedLogin_();
    console.warn('login_: rejected sign-in attempt');
    throw apiError_('UNAUTHORIZED', 'That username and password do not match.');
  }

  clearFailedLogins_();
  var session = issueToken_(getAuthUsername_());
  console.log('login_: issued a session valid until ' + new Date(session.expiresAt).toISOString());

  var ss = getSpreadsheet_();
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    username: session.username,
    version: SPINE_VERSION,
    library: ss.getName(),
    books: readBookColumn_('id').length,
  };
}

/* ───────────── tokens ───────────── */

function issueToken_(username) {
  var issuedAt = Date.now();
  var expiresAt = issuedAt + LIMITS.sessionDays * 24 * 60 * 60 * 1000;
  var body = [TOKEN_VERSION, encodeURIComponent(username), String(issuedAt), String(expiresAt)].join('|');
  return { token: body + '|' + hmacHex_(body), expiresAt: expiresAt, username: username };
}

/**
 * Reject anything that is not a live token signed by this deployment.
 * @return {{username: string, expiresAt: number}} the session it represents
 */
function verifyToken_(token) {
  var expired = apiError_('UNAUTHORIZED', 'Your session has ended. Please sign in again.');
  var parts = String(token).split('|');
  if (parts.length !== 5 || parts[0] !== TOKEN_VERSION) throw expired;

  var body = parts.slice(0, 4).join('|');
  if (!safeEqual_(parts[4], hmacHex_(body))) throw expired;

  var expiresAt = Number(parts[3]);
  if (!isFinite(expiresAt) || Date.now() >= expiresAt) throw expired;

  var username;
  try {
    username = decodeURIComponent(parts[1]);
  } catch (e) {
    throw expired;
  }
  // The signature already pins the password; this pins the username too.
  if (username.toLowerCase() !== getAuthUsername_().toLowerCase()) throw expired;

  return { username: username, expiresAt: expiresAt };
}

/**
 * Gate one request. Public actions pass straight through; everything else needs
 * a valid token in the envelope. Called before any payload is inspected, so an
 * unauthorised caller never learns anything about the data or the validation.
 *
 * @return {?{username: string, expiresAt: number}} the session, or null for public actions
 */
function authorize_(envelope, action) {
  if (publicActions_()[action]) return null;

  if (!isSignInConfigured_()) {
    throw apiError_('NOT_CONFIGURED', 'This library has no sign-in yet. Set AUTH_USERNAME and AUTH_PASSWORD in the script properties.');
  }
  var token = envelope.token;
  if (typeof token !== 'string' || token.length === 0 || token.length > LIMITS.tokenMax) {
    throw apiError_('UNAUTHORIZED', 'Please sign in to use this library.');
  }
  return verifyToken_(token);
}

/* ───────────── brute-force protection ───────────── */

var LOGIN_FAIL_KEY = 'login-failures';

function enforceLoginThrottle_() {
  var failures = Number(CacheService.getScriptCache().get(LOGIN_FAIL_KEY) || 0);
  if (failures >= LIMITS.loginAttempts) {
    throw apiError_('RATE_LIMITED', 'Too many sign-in attempts. Please wait a few minutes and try again.');
  }
}

function recordFailedLogin_() {
  var cache = CacheService.getScriptCache();
  var failures = Number(cache.get(LOGIN_FAIL_KEY) || 0) + 1;
  // Re-putting on every failure slides the window forward, so a sustained
  // attack stays locked out rather than getting a fresh allowance every 15 min.
  cache.put(LOGIN_FAIL_KEY, String(failures), LIMITS.loginLockoutSeconds);
}

function clearFailedLogins_() {
  CacheService.getScriptCache().remove(LOGIN_FAIL_KEY);
}
