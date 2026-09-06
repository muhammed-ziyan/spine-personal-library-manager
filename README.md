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
- No accounts: connect one or more Google Sheets from the You screen and switch between them

## Architecture

```text
React + TypeScript PWA (Vite)
        │  HTTPS — JSON envelope (+ optional access key)
        ▼
Google Apps Script web app   ← validates input and IDs; talks to one Sheet
        │
        ▼
Google Sheets                ← Books · Genres · Settings · Reading History
```

- **Frontend** (`src/`): React 18, TypeScript, CSS Modules with centralised design tokens, React Router, `@zxing/browser` for barcode decoding, `vite-plugin-pwa` for the manifest and service worker.
- **Backend** (`apps-script/`): plain Apps Script (V8). Every mutation is validated, ID generation and duplicate checks run under `LockService`, and user text is escaped so it can never become a spreadsheet formula.
- **Connections instead of accounts**: a *library* is one Apps Script deployment bound to one Google Sheet. You deploy the script to your own sheet and paste its web-app URL into the app; the URL (plus an optional access key) is the whole credential. Saved connections live in the browser on that device, and switching connection is how you switch "account".

```text
src/
├── app/          shell, routing, connection gate
├── components/   BookCard, SearchBar, chips, Rating, Button, FormField, Modal, states…
├── features/     books (form, duplicate sheet), connections (connect form), library (filtering), scanner (camera hook)
├── hooks/        useConnection, useLibrary, usePreferences, useToast
├── pages/        Home, Library, Add, Scanner, BookForm, BookDetail, Stats, You, Connect
├── services/     api client, connections store, config
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

There is nothing to configure at build time. On first launch the app shows a **Connect** screen; paste the web-app URL of a deployed Spine backend (see *Google Apps Script setup*) and you're in.

Optionally, `.env` may hold `VITE_APPS_SCRIPT_URL=…` to pre-fill that screen (see `.env.example`). It is a convenience, not a secret.

#### Developing without a Google deployment

`npm run dev:backend` starts a local stand-in on `http://localhost:8787` that runs the **real** `apps-script/*.gs` code against an in-memory spreadsheet (the same harness the tests use). The dev server serves the app over https (self-signed) and proxies `/api` to that backend, so paste **`/api`** into the Connect screen — it resolves against whatever origin you opened the app from, including the LAN URL on a phone. `DEV_BACKEND_URL` in `.env` changes the proxy target; `DEV_ACCESS_KEY=…` before `npm run dev:backend` exercises the access-key gate. Development builds also accept plain-http localhost/LAN URLs directly (blocked as mixed content when the page itself is https); production builds only talk to `script.google.com`. Data is lost when the process exits.

To test the scanner on a phone, open the **Network** URL Vite prints (https) and accept the self-signed certificate. Browsers only expose the camera on secure origins.

## Google Apps Script setup

Everything below is free and takes about five minutes. Repeat it for every sheet you want as a separate library.

### 1. Create the spreadsheet

1. Create a new Google Sheet (any name, e.g. *Spine Library* — the app shows this name).
2. Open **Extensions → Apps Script**. This creates a script *bound* to the sheet, so the backend can only ever see this one spreadsheet.

### 2. Add the backend code

1. In the Apps Script editor, delete the default `Code.gs` content.
2. Create one file per file in this repo's [`apps-script/`](apps-script/) folder (`Code.gs`, `Config.gs`, `Schema.gs`, `Security.gs`, `Validation.gs`, `Isbn.gs`, `Utils.gs`, `Books.gs`, `Genres.gs`, `Stats.gs`, `Setup.gs`) and paste the contents.
3. Open **Project Settings** (gear icon), tick *Show "appsscript.json" manifest file*, and replace its contents with [`apps-script/appsscript.json`](apps-script/appsscript.json).

   If you prefer the command line, [`clasp`](https://github.com/google/clasp) can push the folder directly: `npx @google/clasp push` from inside `apps-script/` after `clasp login` and `clasp clone <scriptId>`. The local `.clasp.json` is git-ignored.

### 3. Create the tabs

In the editor, select the **`setupSpreadsheet`** function and click **Run**. Approve the permissions when prompted. This creates the `Books`, `Genres`, `Settings` and `Reading History` tabs with headers, fills `Genres` with the default list, and initialises the ID counter. It is safe to run again later.

You can edit the `Genres` tab at any time — the app reads it live.

### 4. (Optional) Set an access key

In **Project Settings → Script Properties** add `ACCESS_KEY` with any long random string. When set, the app must send the same key with every request, so a deployment URL that leaks can be locked out again just by changing the key. Leave it unset for the simplest possible setup. Run **`checkConfiguration`** to confirm what the backend sees.

### 5. Deploy the web app

1. **Deploy → New deployment → Web app.**
2. *Execute as*: **Me**. *Who has access*: **Anyone**.
3. Deploy, approve permissions, and copy the **Web app URL** (ends in `/exec`).

> Why "Anyone"? A PWA on another origin cannot send Google's session cookie to Apps Script, so the URL has to be reachable without a Google login. That makes the URL the credential: **treat it like a password.** Anyone who has it (and the access key, if you set one) can read and write this one sheet — nothing else in your account.

Whenever you change the backend code, create a **new deployment version** (Deploy → Manage deployments → edit → new version) or the live URL keeps serving the old code.

### 6. Connect the app

Open Spine, paste the URL (and the access key, if any) into the Connect screen. The app calls the backend's `ping` action before saving anything, so a typo is caught immediately and the library shows up under its sheet's name. Add more libraries — and switch between them — from **You → Libraries**.

## Security

This repository is designed to be public.

| Value                   | Where it lives                                   | Secret?     | Notes                                                                                             |
| ----------------------- | ------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| Apps Script web app URL | Browser `localStorage` (per device)              | **Treat as one** | Grants access to that one sheet. Never committed; `VITE_APPS_SCRIPT_URL` is only a dev pre-fill. |
| Access key              | Apps Script Script Properties + browser storage  | **Yes**     | Optional. Sent in the POST body, never in the URL. Rotate it in Script Properties to lock out a leaked URL. |
| Spreadsheet             | Bound to the script / `SPREADSHEET_ID` property  | Private     | The client can never choose a spreadsheet, sheet, range or formula.                              |

Controls in the backend:

- **Access** — one deployment serves one sheet, executing as its owner; there is no cross-sheet path. When `ACCESS_KEY` is set, every request's `key` is compared in constant time before any data is touched; a wrong key is rejected as `UNAUTHORIZED` without leaking validation detail.
- **Input validation** — required fields, types, lengths (title/author/publisher ≤ 300, genre/language ≤ 100, notes ≤ 5000), ISBN checksums, enumerated statuses, 1–5 ratings, sane years and page counts. Unknown fields on updates are rejected. Requests over 64 KB are rejected.
- **Formula injection** — any text beginning with `=`, `+`, `-`, `@`, `'` or a control character is stored with a text prefix so Sheets never evaluates it; a genuine leading apostrophe round-trips.
- **IDs and concurrency** — Book IDs come from a persistent counter under `LockService`, never from row counts, so deletions can't cause reuse. Duplicate check + insert happen inside the same lock.
- **Error hygiene** — internal exceptions are logged server-side and returned as a generic message.
- **Rate limiting** — 120 requests per minute per deployment.
- **CORS** — Apps Script forces `Access-Control-Allow-Origin: *` and cannot answer pre-flights; requests are therefore sent as simple `text/plain` POSTs. Production builds refuse to talk to anything but `script.google.com`.
- **XSS** — all book data is rendered through React's escaped output; no `innerHTML`.
- **Camera** — started only when you tap *Start Scanning*, stopped on success, cancel, navigation or backgrounding; frames are decoded in-browser and never stored or uploaded.

Before publishing, `npm test` runs the backend against an in-memory Sheets stand-in covering the access key, validation, duplicates, ID generation, formula escaping and error leakage.

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
