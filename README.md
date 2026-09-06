# Spine

Personal library management app. Scan the barcode on a book you own, type in a few details, and it's on your shelf — stored in a Google Sheet you control, at zero infrastructure cost.

Spine tracks **physical copies**: two editions of *The Hobbit* are two records with two IDs, even though they may share an ISBN.

## Features

- Barcode scanning with the device camera (ISBN/EAN, decoded locally — nothing is uploaded)
- ISBN-10 and ISBN-13 capture, normalisation and validation
- Automatic book details from Open Library after a scan — title, author, publisher, year, pages, format, language and cover art, all editable before saving
- Manual book entry for books without a barcode
- Server-side duplicate detection with a "you already have this book → add another copy" flow
- Individual physical-copy tracking with immutable, server-generated IDs (`BK-00001`)
- Search by title, author or ISBN
- Filters by status, genre and language; sort by title, author, date added or rating
- List and grid views
- Reading status (Unread / Reading / Read / On Hold / Abandoned) with a reading-history log
- Ratings and notes
- Installable PWA with a mobile-first, warm, minimal interface
- Password sign-in checked by your own Apps Script — no Google OAuth, no third-party identity provider

## Architecture

```text
React + TypeScript PWA (Vite, deployed to Vercel)
        │  HTTPS — JSON envelope + session token
        ▼
Google Apps Script web app   ← checks the password, signs tokens, validates input
        │
        ▼
Google Sheets                ← Books · Genres · Settings · Reading History
```

- **Frontend** (`src/`): React 18, TypeScript, CSS Modules with centralised design tokens, React Router, `@zxing/browser` for barcode decoding, `vite-plugin-pwa` for the manifest and service worker.
- **Backend** (`apps-script/`): plain Apps Script (V8). Every mutation is validated, ID generation and duplicate checks run under `LockService`, and user text is escaped so it can never become a spreadsheet formula.
- **Sign-in without an identity provider**: one deployment serves one sheet, and its address is baked into the build (`VITE_APPS_SCRIPT_URL`). That address grants nothing — the backend refuses every action but `login` without a token. Signing in posts a username and password to your own Apps Script, which compares them against its Script Properties and returns an HMAC-signed token valid for 30 days. **No credential is ever present in the front-end bundle**, and there is no Google OAuth consent screen to sit through. See *Security*.

```text
src/
├── app/          shell, routing, sign-in gate
├── components/   BookCard, SearchBar, chips, Rating, Button, FormField, Modal, states…
├── features/     auth (sign-in form), books (form, duplicate sheet), library (filtering), scanner (camera hook)
├── hooks/        useSession, useLibrary, usePreferences, useToast
├── pages/        Home, Library, Add, Scanner, BookForm, BookDetail, Stats, You, SignIn
├── services/     api client, session store, config
├── styles/       tokens.css, global.css
├── types/        Book, BookStatus, LibraryStats, API contracts
└── utils/        isbn, validation, formatting
```

## Local development

### 1. Clone and install

```bash
git clone https://github.com/<you>/spine-personal-library-manager.git
cd spine-personal-library-manager
npm install
```

### 2. Run

```bash
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
npm test           # unit + backend tests
npm run lint
npm run typecheck
```

Copy `.env.example` to `.env` first. Two things are configured there:

| Variable | Purpose |
| --- | --- |
| `VITE_APPS_SCRIPT_URL` | The deployment the app talks to: `/api` locally, the `/exec` URL in production. Ships inside the bundle, and is not a secret. |
| `SPINE_AUTH_USERNAME` / `SPINE_AUTH_PASSWORD` | The sign-in the **local dev backend** accepts. No `VITE_` prefix, so they never reach the browser. |

Quote a password containing `#`, spaces or quotes. Node reads an unquoted `#` in a `.env` file as the start of a comment, and would silently truncate the value.

#### Developing without a Google deployment

`npm run dev:backend` starts a local stand-in on `http://localhost:8787` that runs the **real** `apps-script/*.gs` code against an in-memory spreadsheet (the same harness the tests use), sign-in included. It reads `SPINE_AUTH_USERNAME` and `SPINE_AUTH_PASSWORD` from `.env` and refuses to start without them, exactly as a freshly deployed script refuses every request until its Script Properties are set.

The dev server serves the app over https (self-signed) and proxies `/api` to that backend, which is what `VITE_APPS_SCRIPT_URL=/api` points at: it resolves against whatever origin you opened the app from, including the LAN URL on a phone. `DEV_BACKEND_URL` in `.env` changes the proxy target. Development builds also accept plain-http localhost/LAN URLs directly (blocked as mixed content when the page itself is https); production builds only talk to `script.google.com`. Data is lost when the process exits.

To test the scanner on a phone, open the **Network** URL Vite prints (https) and accept the self-signed certificate. Browsers only expose the camera on secure origins.

## Google Apps Script setup

Everything below is free and takes about five minutes.

### 1. Create the spreadsheet

1. Create a new Google Sheet (any name, e.g. *Spine Library* — the app shows this name).
2. Open **Extensions → Apps Script**. This creates a script *bound* to the sheet, so the backend can only ever see this one spreadsheet.

### 2. Add the backend code

1. In the Apps Script editor, delete the default `Code.gs` content.
2. Create one file per file in this repo's [`apps-script/`](apps-script/) folder (`Auth.gs`, `Code.gs`, `Config.gs`, `Schema.gs`, `Security.gs`, `Validation.gs`, `Isbn.gs`, `Utils.gs`, `Books.gs`, `Genres.gs`, `Stats.gs`, `Setup.gs`) and paste the contents.
3. Open **Project Settings** (gear icon), tick *Show "appsscript.json" manifest file*, and replace its contents with [`apps-script/appsscript.json`](apps-script/appsscript.json).

   If you prefer the command line, [`clasp`](https://github.com/google/clasp) can push the folder directly: `npx @google/clasp push` from inside `apps-script/` after `clasp login` and `clasp clone <scriptId>`. The local `.clasp.json` is git-ignored.

### 3. Create the tabs

In the editor, select the **`setupSpreadsheet`** function and click **Run**. Approve the permissions when prompted. This creates the `Books`, `Genres`, `Settings` and `Reading History` tabs with headers, fills `Genres` with the default list, and initialises the ID counter. It is safe to run again later.

You can edit the `Genres` tab at any time — the app reads it live.

### 4. Set the sign-in — required

In **Project Settings → Script Properties** add two properties:

| Property | Value |
| --- | --- |
| `AUTH_USERNAME` | The username you will sign in with, e.g. `you@example.com`. Case-insensitive. |
| `AUTH_PASSWORD` | A long password. This is the only thing guarding your library, so make it a real one. |

Until both are set the API answers `NOT_CONFIGURED` to **everything**, sign-in included: it fails closed, never open. A third property, `AUTH_SECRET`, appears by itself on the first sign-in and is the key that signs session tokens — leave it alone.

Run **`checkConfiguration`** to confirm what the backend sees; it prints the username, never the password. If you would rather not type into the properties UI, fill in and run **`setCredentials`** in `Setup.gs` instead, then blank it out again.

Two ways to end every signed-in session at once: change `AUTH_PASSWORD`, or run **`resetSessions`**. Both invalidate outstanding tokens immediately, because the token signature is derived from the password and the secret together.

### 5. Deploy the web app

1. **Deploy → New deployment → Web app.**
2. *Execute as*: **Me**. *Who has access*: **Anyone**.
3. Deploy, approve permissions, and copy the **Web app URL** (ends in `/exec`).

> Why "Anyone"? A PWA on another origin cannot send Google's session cookie to Apps Script, so the URL has to be reachable without a Google login. It is public anyway, since it ships inside the front-end bundle — which is exactly why the URL is not the credential. Without a valid session token the backend answers `UNAUTHORIZED` to every action but `login`, and `login` needs your password.

Whenever you change the backend code, create a **new deployment version** (Deploy → Manage deployments → edit → new version) or the live URL keeps serving the old code.

### 6. Point the app at it

Set `VITE_APPS_SCRIPT_URL` to the `/exec` URL and rebuild. On **Vercel** that is *Project → Settings → Environment Variables*, followed by a **redeploy**: Vite bakes the value in at build time, so an existing deployment will not pick it up on its own. Locally it goes in `.env`. A build with no URL says so on the sign-in screen rather than failing at the first request.

Then open the app and sign in with the username and password you put in Script Properties. The session lasts 30 days on that device; **You → Account → Sign out** ends it early.

Only `VITE_`-prefixed variables reach the browser, which is precisely why the password is not one of them. Never add the password to Vercel's environment: it belongs in Script Properties, where only your Apps Script can read it.

### 7. Deploy to Vercel

Import the repository at [vercel.com/new](https://vercel.com/new). Vercel reads `vercel.json` and needs no manual configuration — framework *Vite*, `npm run build`, output `dist/`. The only thing you must add is the `VITE_APPS_SCRIPT_URL` environment variable above.

`vercel.json` also handles:

- **Single-page-app rewrites**, so deep links like `/books/BK-00007` survive a refresh. Static files are matched first, so the service worker and assets are still served normally.
- **Caching** — the hashed files in `/assets` are immutable for a year; fonts and icons for 30 days; `sw.js` and the manifest are always revalidated, so an update reaches an installed PWA on the next launch.
- **Security headers**, including a Content-Security-Policy that limits the app to its own origin plus `script.google.com` and `openlibrary.org`. See *Security* below.

Before pushing, the same checks CI would run:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

`npm run preview` serves the built bundle, but without the headers from `vercel.json` — a Vercel preview deployment is the faithful test.

#### Updating

Every push to `main` redeploys. Because `VITE_APPS_SCRIPT_URL` is baked in at build time, changing it in Vercel's settings requires a **redeploy** to take effect; changing the *Apps Script* code instead requires a new deployment version there, and no rebuild here.

## Security

This repository is designed to be public.

| Value | Where it lives | Secret? | Notes |
| --- | --- | --- | --- |
| Apps Script web app URL | `VITE_APPS_SCRIPT_URL`, baked into the bundle | No | Public by construction. Grants nothing on its own. |
| Username and password | Apps Script Script Properties only | **Yes** | Never in the repo, never in the bundle, never in Vercel. Compared server-side; the password is never echoed back. |
| Session token | Browser `localStorage` (per device) | **Yes** | HMAC-signed by the deployment, expires after 30 days. Sent in the POST body, never in the URL. |
| `AUTH_SECRET` | Apps Script Script Properties (auto-generated) | **Yes** | Signs tokens. Delete it, or run `resetSessions`, to sign every device out. |
| Spreadsheet | Bound to the script / `SPREADSHEET_ID` property | Private | The client can never choose a spreadsheet, sheet, range or formula. |

Controls in the backend:

- **Authentication** — one deployment serves one sheet, executing as its owner; there is no cross-sheet path. Every action but `login` requires a token, checked before any payload is inspected, so an unauthorised caller learns nothing about the data or the validation. Username and password are compared in constant time over digests, and a wrong username and a wrong password produce the identical message.
- **Sessions** — tokens are HMAC-SHA256-signed and stateless, so nothing is stored server-side and cold starts cost nothing. The signing key mixes `AUTH_SECRET` with a digest of the current password, so **changing the password immediately invalidates every outstanding token**; so does rotating the secret. Tokens expire after 30 days, are bound to the username, and a token from one deployment is meaningless to another.
- **Brute force** — 8 failed sign-ins lock the door for 15 minutes, and each further attempt slides that window forward.
- **Input validation** — required fields, types, lengths (title/author/publisher ≤ 300, genre/language ≤ 100, notes ≤ 5000), ISBN checksums, enumerated statuses, 1–5 ratings, sane years and page counts. Unknown fields on updates are rejected. Requests over 64 KB are rejected.
- **Formula injection** — any text beginning with `=`, `+`, `-`, `@`, `'` or a control character is stored with a text prefix so Sheets never evaluates it; a genuine leading apostrophe round-trips.
- **IDs and concurrency** — Book IDs come from a persistent counter under `LockService`, never from row counts, so deletions can't cause reuse. Duplicate check + insert happen inside the same lock.
- **Error hygiene** — internal exceptions are logged server-side and returned as a generic message.
- **Rate limiting** — 120 requests per minute per deployment.
- **CORS** — Apps Script forces `Access-Control-Allow-Origin: *` and cannot answer pre-flights; requests are therefore sent as simple `text/plain` POSTs. Production builds refuse to talk to anything but `script.google.com`.
- **XSS** — all book data is rendered through React's escaped output; no `innerHTML`.
- **Response headers** (`vercel.json`) — a Content-Security-Policy confines the app to its own origin: scripts and fonts from `'self'` only, connections only to `script.google.com`, `script.googleusercontent.com` (where Apps Script redirects) and `openlibrary.org`, images additionally from `covers.openlibrary.org`. `object-src 'none'`, `base-uri 'self'` and `frame-ancestors 'none'` close the usual injection escape hatches. `style-src` allows `'unsafe-inline'` because React writes a handful of computed `style` attributes — progress bars and skeletons. Alongside it: HSTS, `nosniff`, `X-Frame-Options: DENY` and a `Permissions-Policy` granting the camera to this origin alone, denying microphone and geolocation outright.
- **Build hygiene** — production bundles carry no sourcemaps and no request tracing; the `[spine]` debug log that prints each payload is dropped by the minifier, while `console.error` is kept so a misconfigured deployment can still be diagnosed. `robots.txt` asks crawlers to stay out.
- **Camera** — started only when you tap *Start Scanning*, stopped on success, cancel, navigation or backgrounding; frames are decoded in-browser and never stored or uploaded.

Before publishing, `npm test` runs the backend against an in-memory Sheets stand-in covering sign-in, token forgery and expiry, lockout, validation, duplicates, ID generation, formula escaping and error leakage.

## Google Sheet layout

| Tab               | Columns                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Books`           | Book ID · ISBN · Title · Author · Genre · Language · Publisher · Publication Year · Edition · Pages · Format · Status · Rating · Date Added · Date Started · Date Finished · Notes · Cover URL · Updated At |
| `Genres`          | Genre                                                                                                                                                                                |
| `Settings`        | Key · Value (`schemaVersion`, `bookIdCounter` mirror)                                                                                                                                |
| `Reading History` | Book ID · Previous Status · New Status · Changed At                                                                                                                                  |

Column order is defined once in [`apps-script/Schema.gs`](apps-script/Schema.gs); nothing else depends on column positions.

## License

MIT
