# Spine

Personal library management app. Scan the barcode on a book you own, type in a few details, and it's on your shelf — stored in a Google Sheet you control, at zero infrastructure cost.

Spine tracks **physical copies**: two editions of *The Hobbit* are two records with two IDs, even though they may share an ISBN.

## Features

- Barcode scanning with the device camera (ISBN/EAN, decoded locally — nothing is uploaded)
- ISBN-10 and ISBN-13 capture, normalisation and validation
- Manual book entry for books without a barcode
- Server-side duplicate detection with a "you already have this book → add another copy" flow
- Individual physical-copy tracking with immutable, server-generated IDs (`BK-00001`)
- Search by title, author or ISBN
- Filters by status, genre and language; sort by title, author, date added or rating
- List and grid views
- Reading status (Unread / Reading / Read / On Hold / Abandoned) with a reading-history log
- Ratings and notes
- Statistics: totals, status breakdown, genres, languages, average rating
- Installable PWA with a mobile-first, warm, minimal interface

## Architecture

```text
React + TypeScript PWA (Vite)
        │  HTTPS — JSON envelope + Google ID token
        ▼
Google Apps Script web app   ← validates identity, input, IDs; talks to Sheets
        │
        ▼
Google Sheets                ← Books · Genres · Settings · Reading History
```

- **Frontend** (`src/`): React 18, TypeScript, CSS Modules with centralised design tokens, React Router, `@zxing/browser` for barcode decoding, `vite-plugin-pwa` for the manifest and service worker.
- **Backend** (`apps-script/`): plain Apps Script (V8). Every mutation is validated, ID generation and duplicate checks run under `LockService`, and user text is escaped so it can never become a spreadsheet formula.
- **Auth**: Google Identity Services in the browser issues a short-lived ID token; Apps Script verifies it against Google's `tokeninfo` endpoint, checks the OAuth client ID, and only serves the account(s) on its allow-list. No passwords, no auth database.

```text
src/
├── app/          shell, routing, account menu
├── components/   BookCard, SearchBar, chips, Rating, Button, FormField, Modal, states…
├── features/     books (form, duplicate sheet), library (filtering), scanner (camera hook)
├── hooks/        useAuth, useLibrary, useToast
├── pages/        Home, Library, Add, Scanner, BookForm, BookDetail, Stats, SignIn, Setup
├── services/     api client, auth, config
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

### 2. Configure the environment

```bash
cp .env.example .env
```

Fill in the two values (see *Google Apps Script setup* below for where they come from):

```text
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/…/exec
VITE_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
```

`.env` is git-ignored. Until both values are set the app shows a setup screen instead of the library.

### 3. Run

```bash
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
npm test           # unit + backend tests
npm run lint
npm run typecheck
```

#### Developing without a Google deployment

`npm run dev:backend` starts a local stand-in on `http://localhost:8787` that runs the **real** `apps-script/*.gs` code against an in-memory spreadsheet (the same harness the tests use). Point the app at it with:

```text
VITE_APPS_SCRIPT_URL=http://localhost:8787
VITE_GOOGLE_CLIENT_ID=local-dev
```

With that client ID, development builds show a *"Use local development session"* button instead of Google sign-in. This path is dead code in production builds, localhost URLs are rejected outside development, and a deployed backend rejects the unsigned token anyway. Data is lost when the process exits.

To test the scanner on a phone, run `npm run dev` and open the `https://<your-LAN-IP>:5173` URL it prints. Browsers only expose the camera on secure origins, so the dev server serves a self-signed certificate — accept the browser's one-time warning (Advanced → Proceed). Point `VITE_APPS_SCRIPT_URL` at `/api` so requests to the local dev backend go through the dev server's proxy instead of being blocked as mixed content (set `DEV_BACKEND_URL` if the backend isn't on port 8787). Alternatively deploy the built `dist/` folder to any static host (GitHub Pages, Netlify, Cloudflare Pages — all free) and add that origin to your OAuth client.

## Google Apps Script setup

Everything below is free and takes about ten minutes.

### 1. Create the spreadsheet

1. Create a new Google Sheet (any name, e.g. *Spine Library*).
2. Open **Extensions → Apps Script**. This creates a script *bound* to the sheet, so the backend can only ever see this one spreadsheet.

### 2. Add the backend code

1. In the Apps Script editor, delete the default `Code.gs` content.
2. Create one file per file in this repo's [`apps-script/`](apps-script/) folder (`Code.gs`, `Config.gs`, `Schema.gs`, `Security.gs`, `Validation.gs`, `Isbn.gs`, `Utils.gs`, `Books.gs`, `Genres.gs`, `Stats.gs`, `Setup.gs`) and paste the contents.
3. Open **Project Settings** (gear icon), tick *Show "appsscript.json" manifest file*, and replace its contents with [`apps-script/appsscript.json`](apps-script/appsscript.json).

   If you prefer the command line, [`clasp`](https://github.com/google/clasp) can push the folder directly: `npx @google/clasp push` from inside `apps-script/` after `clasp login` and `clasp clone <scriptId>`. The local `.clasp.json` is git-ignored.

### 3. Create the tabs

In the editor, select the **`setupSpreadsheet`** function and click **Run**. Approve the permissions when prompted. This creates the `Books`, `Genres`, `Settings` and `Reading History` tabs with headers, fills `Genres` with the default list, and initialises the ID counter. It is safe to run again later.

You can edit the `Genres` tab at any time — the app reads it live.

### 4. Create an OAuth client ID

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) (any project; create one if needed).
2. If prompted, configure the OAuth consent screen (External, just your own account as a test user is fine).
3. **Create credentials → OAuth client ID → Web application.**
4. Under *Authorised JavaScript origins* add every origin you'll open Spine from, e.g. `http://localhost:5173` and your deployed `https://` origin.
5. Copy the **Client ID**. You do **not** need the client secret — Spine never uses it. Leave it in the console.

### 5. Configure access

In the Apps Script editor, open **Project Settings → Script Properties** and add:

| Property           | Value                                                            |
| ------------------ | ---------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID` | the client ID from step 4                                        |
| `ALLOWED_EMAILS`   | your Google account email (comma-separate several if you like)   |

The backend refuses every request until both are set. Run **`checkConfiguration`** to confirm.

### 6. Deploy the web app

1. **Deploy → New deployment → Web app.**
2. *Execute as*: **Me**. *Who has access*: **Anyone**.
3. Deploy, approve permissions, and copy the **Web app URL** (ends in `/exec`).

> Why "Anyone"? A PWA on another origin cannot send Google's session cookie to Apps Script, so the URL has to be reachable. That is exactly why the URL is *not* the access control: every request must carry a Google ID token for an allow-listed account, and the backend verifies it before touching any data.

Whenever you change the backend code, create a **new deployment version** (Deploy → Manage deployments → edit → new version) or the live URL keeps serving the old code.

### 7. Connect the frontend

Put the web app URL and the client ID into `.env` (local) or your host's environment variables (production), rebuild, and sign in with the allow-listed account.

## Security

This repository is designed to be public.

| Value                     | Where it lives                                 | Secret? | Notes                                                                                 |
| ------------------------- | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| Apps Script web app URL   | `.env` → `VITE_APPS_SCRIPT_URL`                | No      | Public endpoint by design; never the access control. Keep it out of Git regardless.   |
| OAuth **client ID**       | `.env` → `VITE_GOOGLE_CLIENT_ID`               | No      | Public identifier. Restricted by the authorised origins you configure.                |
| OAuth **client secret**   | Google Cloud Console only                      | **Yes** | Never used by Spine. Do not copy it anywhere in this project.                         |
| Allowed account emails    | Apps Script → Script Properties                | Private | Server-side only.                                                                     |
| Spreadsheet               | Bound to the script / `SPREADSHEET_ID` property | Private | The client can never choose a spreadsheet, sheet, range or formula.                   |
| Google session / ID token | Browser memory + `sessionStorage`              | Private | Short-lived (1 h), sent only to the Apps Script URL, verified server-side.            |

Controls in the backend:

- **Identity** — every request's ID token is verified with Google (`aud`, `iss`, `email_verified`, `exp`) and the email must be on `ALLOWED_EMAILS`. Verified tokens are cached briefly by hash.
- **Input validation** — required fields, types, lengths (title/author/publisher ≤ 300, genre/language ≤ 100, notes ≤ 5000), ISBN checksums, enumerated statuses, 1–5 ratings, sane years and page counts. Unknown fields on updates are rejected. Requests over 64 KB are rejected.
- **Formula injection** — any text beginning with `=`, `+`, `-`, `@`, `'` or a control character is stored with a text prefix so Sheets never evaluates it; a genuine leading apostrophe round-trips.
- **IDs and concurrency** — Book IDs come from a persistent counter under `LockService`, never from row counts, so deletions can't cause reuse. Duplicate check + insert happen inside the same lock.
- **Error hygiene** — internal exceptions are logged server-side and returned as a generic message.
- **Rate limiting** — 120 requests per minute per account.
- **CORS** — Apps Script forces `Access-Control-Allow-Origin: *` and cannot answer pre-flights; requests are therefore sent as simple `text/plain` POSTs and the token check above is the compensating control.
- **XSS** — all book data is rendered through React's escaped output; no `innerHTML`.
- **Camera** — started only when you tap *Start Scanning*, stopped on success, cancel, navigation or backgrounding; frames are decoded in-browser and never stored or uploaded.

Before publishing, `npm test` runs the backend against an in-memory Sheets stand-in covering auth, validation, duplicates, ID generation, formula escaping and error leakage.

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
