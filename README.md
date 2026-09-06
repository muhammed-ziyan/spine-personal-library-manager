# Spine

A personal library in your pocket. Scan the barcode on a book you own, add a few details if you like, and it lives on a shelf you control — a Google Sheet in your own Drive.

There is no server to rent and no database to keep alive. The website is a free [Vercel](https://vercel.com) app; the books live in a spreadsheet only you can open in Google Sheets. Spine is MIT-licensed: fork it, run it, make it yours.

Spine tracks **physical copies**. Two editions of *The Hobbit* are two records with two IDs, even if they share an ISBN.

## What you get

- Scan a barcode with your phone camera (decoded on the device — the picture never leaves the phone)
- Title, author, cover and more filled in from [Open Library](https://openlibrary.org), all editable before you save
- Type a book in by hand when there is no barcode
- A heads-up if you already own it, with the option to add another copy anyway
- Search, filters, list and grid views
- Reading status, star ratings, notes, and a quiet log of when a book changed status
- Add to your home screen like a real app
- A username and password you choose yourself — no Google login screen, no extra account

## Deploy your own

You will end up with two things that talk to each other:

1. A **Google Sheet** (with a small Apps Script attached) that holds your library.
2. A **website** on Vercel that is the app itself.

Both are free on the usual free plans. Give yourself about ten minutes, a Google account, and a GitHub account.

### 1. Fork this repository

On GitHub, open [this repo](https://github.com/muhammed-ziyan/spine-personal-library-manager) and click **Fork**. That gives you your own copy to deploy from. You can clone it to your computer later if you want; you do not need to, just to get a live app.

### 2. Create the spreadsheet

1. Go to [sheets.google.com](https://sheets.google.com) and start a new blank spreadsheet. Name it something like *Spine Library* — the app shows this name.
2. Open **Extensions → Apps Script**. Google creates a script *bound* to this sheet, which is what you want: the backend can only ever see this one spreadsheet.

Leave that Apps Script tab open. You will paste the backend into it next.

### 3. Add the backend code

In the Apps Script editor:

1. Delete whatever is in the default `Code.gs` file.
2. Create one file for each of these (the **+** next to *Files*, then *Script*) and paste in the matching file from this repo’s [`apps-script/`](apps-script/) folder:

   `Auth.gs` · `Code.gs` · `Config.gs` · `Schema.gs` · `Security.gs` · `Validation.gs` · `Isbn.gs` · `Utils.gs` · `Books.gs` · `Genres.gs` · `Stats.gs` · `Setup.gs`

3. Open **Project Settings** (the gear), tick *Show "appsscript.json" manifest file*, and replace that file with [`apps-script/appsscript.json`](apps-script/appsscript.json).

If you would rather not copy-paste, [clasp](https://github.com/google/clasp) can push the folder for you after `clasp login` and `clasp clone <scriptId>`: from `apps-script/`, run `npx @google/clasp push`. The local `.clasp.json` stays off git, on purpose.

### 4. Create the tabs

In the editor, choose the function **`setupSpreadsheet`** at the top of the screen and click **Run**. The first time, Google will ask you to approve access to the spreadsheet — that is expected; say yes.

This creates four tabs (`Books`, `Genres`, `Settings`, `Reading History`), fills in a starter list of genres, and starts the book-ID counter. It is safe to run again later; existing books are left alone.

You can edit the `Genres` tab whenever you like. The app reads it live.

### 5. Choose your sign-in

This username and password are the only lock on your library, so pick a real password (twelve characters or more).

In **Project Settings → Script Properties**, add two properties:

| Property | What to put |
| --- | --- |
| `AUTH_USERNAME` | What you will type at sign-in, e.g. `you@example.com`. Case does not matter. |
| `AUTH_PASSWORD` | A long password. |

Until both are set, the app will not sign anyone in — it fails closed, which is what you want.

A third property, `AUTH_SECRET`, appears by itself the first time you sign in. Leave it alone; it is how sessions are signed.

Prefer not to type into that UI? Open `Setup.gs`, fill in `setCredentials`, run it once, then blank the password out of the file and save. Run **`checkConfiguration`** any time to confirm the backend can see a username (it never prints the password).

To sign every device out at once: change `AUTH_PASSWORD`, or run **`resetSessions`**.

### 6. Publish the backend

1. **Deploy → New deployment**.
2. Click the gear next to *Select type* and choose **Web app**.
3. *Execute as*: **Me**. *Who has access*: **Anyone**.
4. Click **Deploy**, approve if asked, and copy the **Web app URL**. It ends in `/exec`. Keep it handy.

Why “Anyone”? The website lives on a different address than the script, so it cannot ride along on your Google login. The URL itself is not a secret and grants nothing — without your password the backend will not touch the sheet.

Whenever you change the backend files later, open **Deploy → Manage deployments**, edit the existing one, and choose **New version**. Otherwise the live URL keeps serving the old code.

### 7. Put the app on the web

1. Go to [vercel.com/new](https://vercel.com/new) and import your fork. Vercel already knows this is a Vite app (`npm run build`, output `dist/`) — you do not need to change the build settings.
2. Before you deploy, add one environment variable:

   | Name | Value |
   | --- | --- |
   | `VITE_APPS_SCRIPT_URL` | The `/exec` URL you copied in the previous step |

3. Deploy. Open the `*.vercel.app` URL Vercel gives you, tap **Get Spine** / **Sign in**, and use the username and password from Script Properties.

That is the whole setup. Your session lasts 30 days on that device; **You → Account → Sign out** ends it early.

**Please do not put the password in Vercel.** Only variables that start with `VITE_` are built into the website, which is exactly why the password is not one of them. It belongs in Script Properties, where only your Apps Script can read it.

Vite bakes `VITE_APPS_SCRIPT_URL` in at build time. If you ever change it in Vercel, click **Redeploy** so the new value is actually used. Changing the Apps Script code instead needs a new deployment version *there* — no rebuild of the website.

From your phone: open the site, then use *Add to Home Screen* (Safari) or *Install app* (Chrome). After that it feels like a normal app, camera and all.

## If something looks wrong

| What you see | What to try |
| --- | --- |
| Sign-in says the app has no library address | `VITE_APPS_SCRIPT_URL` is missing, or you changed it and have not redeployed yet. |
| Sign-in says the library is not configured | `AUTH_USERNAME` and `AUTH_PASSWORD` are not both set in Script Properties. Run `checkConfiguration` in the Apps Script editor. |
| Wrong password, even though you are sure | Check for a stray space. If the password has `#`, quotes or spaces and you set it from a `.env` file locally, wrap it in quotes. |
| Backend changes do not show up | Create a **new version** of the existing web-app deployment, not a brand-new deployment with a new URL. |
| Camera never starts | The page must be HTTPS (Vercel already is). Browsers hide the camera on plain `http://`, except sometimes on `localhost`. |
| An old phone still shows an old version | Close the installed app fully and open it again. The service worker picks up updates on the next launch. |

## Local development

Useful if you want to try Spine on your computer before (or instead of) deploying.

You need [Node.js 20.19 or newer](https://nodejs.org/).

```bash
git clone https://github.com/muhammed-ziyan/spine-personal-library-manager.git
cd spine-personal-library-manager
npm install
```

Copy `.env.example` to `.env`. Two things live there:

| Variable | Purpose |
| --- | --- |
| `VITE_APPS_SCRIPT_URL` | Where the app talks. Locally this is `/api` (the Vite proxy). In production it is your `/exec` URL. This is not a secret. |
| `SPINE_AUTH_USERNAME` / `SPINE_AUTH_PASSWORD` | The sign-in the **local** backend accepts. No `VITE_` prefix, so they never reach the browser. |

Quote a password that contains `#`, spaces or quotes. Node treats an unquoted `#` as the start of a comment and would silently chop the value.

```bash
npm run dev:backend   # local stand-in for Apps Script, http://localhost:8787
npm run dev            # the app itself, https://localhost:5173
```

`npm run dev:backend` runs the real `apps-script/*.gs` files against an in-memory spreadsheet (the same harness the tests use). It reads the username and password from `.env` and will not start without them. Data disappears when you stop the process.

The Vite dev server is HTTPS (a self-signed certificate) and proxies `/api` to that backend, which is what `VITE_APPS_SCRIPT_URL=/api` points at. `DEV_BACKEND_URL` in `.env` changes the proxy target if you need it to.

To try the scanner on a phone, open the **Network** URL Vite prints and accept the certificate warning. Production builds only talk to `script.google.com`; development builds also allow your local or LAN address.

Other commands:

```bash
npm run build       # production build in dist/
npm run preview     # serve that build
npm test            # unit + backend tests
npm run lint
npm run typecheck
```

`npm run preview` does not apply the headers from `vercel.json`. A Vercel preview deployment is the faithful test of the live site.

## Your data

Your books sit in a Google Sheet in your Drive. You can open it, search it, export it, or delete it like any other spreadsheet. The website never chooses which sheet to use — that is locked to the script you attached.

The password never ships in the app. The public `/exec` URL is not a key; without a signed-in session the backend refuses every action except “please sign in.” Changing the password (or running `resetSessions`) signs every device out immediately.

## License

MIT
