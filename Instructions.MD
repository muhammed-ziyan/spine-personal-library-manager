# Spine — Personal Library Management App

Build **Spine**, a mobile-first personal library management PWA based on the provided UI design.

The attached/provided UI design is the **visual source of truth**. Implement the interface faithfully, while following the technical architecture and security requirements below.

---

# 1. PRODUCT

**Spine** is a personal physical-book library management app.

Its primary purpose is:

1. Scan a book's barcode.
2. Obtain the ISBN from the barcode.
3. Check whether that ISBN already exists in the library.
4. If it exists, warn the user and allow them to add another physical copy.
5. If it doesn't exist, show a simple book-entry form.
6. Store the book in Google Sheets through Google Apps Script.
7. Browse, search, filter, edit, rate, and manage the collection.

There is **no Google Books API** or external book metadata service.

The user manually enters book information after scanning.

The app should remain useful even when a book has no ISBN/barcode.

---

# 2. CORE PRODUCT DECISION: PHYSICAL COPIES

Every physical copy is an independent library record.

Example:

```text
ISBN: 9781234567890

BK-00021 → The Hobbit → Paperback
BK-00057 → The Hobbit → Hardcover
```

Therefore:

* `Book ID` is the unique identifier of a physical copy.
* `ISBN` identifies the book edition.
* ISBNs may be duplicated.
* Book IDs must never be duplicated.
* Never use spreadsheet row number as the Book ID.
* Book ID is generated server-side by Apps Script.
* Book ID is immutable after creation.

When a duplicate ISBN is detected:

```text
You already have this book

The Hobbit
J.R.R. Tolkien

1 copy already in your library

[View Existing]
[Add Another Copy]
```

Never automatically reject duplicate ISBNs.

---

# 3. TECHNICAL ARCHITECTURE

Use this architecture:

```text
                    ┌─────────────────────┐
                    │      Spine PWA      │
                    │                     │
                    │ React + TypeScript  │
                    │ Mobile-first UI     │
                    └──────────┬──────────┘
                               │
                               │ HTTPS
                               ▼
                    ┌─────────────────────┐
                    │ Google Apps Script  │
                    │                     │
                    │ Backend/API         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Google Sheets     │
                    │                     │
                    │ Library database    │
                    └─────────────────────┘
```

Use:

* React
* TypeScript
* Vite
* PWA support
* Modern CSS / CSS modules or the project's existing styling approach
* Google Apps Script as backend
* Google Sheets as persistent database

Do not introduce:

* Supabase
* Firebase
* PostgreSQL
* MySQL
* MongoDB
* Google Books API
* paid services
* external authentication providers

The project must be capable of running at **zero infrastructure cost**.

---

# 4. FIRST: INSPECT BEFORE CODING

Before modifying or creating files:

1. Inspect the existing repository.
2. Identify the current framework and tooling.
3. Inspect package.json.
4. Inspect existing source structure.
5. Inspect the provided UI/design assets.
6. Determine whether a project already exists.
7. Reuse existing infrastructure where sensible.
8. Do not unnecessarily replace the existing framework.
9. Do not start implementing until you understand the current repository.

If the repository is empty, create the appropriate React + TypeScript + Vite structure.

Keep the project clean and production-ready.

---

# 5. UI SOURCE OF TRUTH

The provided Claude Design output is the **primary visual reference**.

Implement its:

* layout
* spacing
* typography
* colors
* border radius
* cards
* navigation
* interactions
* responsive behavior
* component hierarchy

Do not replace the design with a generic template.

The visual direction should remain:

* modern
* consumer-oriented
* minimal
* warm
* spacious
* rounded
* highly legible

It should NOT resemble:

* ERP software
* library administration software
* CRUD dashboards
* spreadsheet interfaces
* corporate SaaS dashboards

The Fold Money app was used only as broad visual inspiration. Do not copy its branding, assets, exact layouts, or proprietary design.

---

# 6. RESPONSIVE DESIGN

Primary target:

```text
390 × 844
430 × 932
```

Also support:

* tablet
* desktop

Mobile is the priority.

On desktop:

* constrain content width
* maintain comfortable reading width
* don't stretch everything across the viewport
* preserve the mobile application's visual character

The UI must feel intentional at every breakpoint.

---

# 7. APPLICATION STRUCTURE

Create these primary sections:

```text
Home
Library
Add
Stats
```

Use bottom navigation on mobile.

The Add action should be visually emphasized.

---

# 8. HOME

Implement:

* library total
* reading-status summary
* Scan Book primary action
* Add Manually secondary action
* status overview
* recently added books

Example information:

```text
127 Books

42 Read
3 Reading
82 Unread
```

These values must come from the backend/database.

Never hardcode statistics.

---

# 9. LIBRARY

Implement:

### Search

Search:

* title
* author
* ISBN

### Filters

* All
* Unread
* Reading
* Read
* Genre
* Language

### Sorting

At minimum:

* Title
* Author
* Date Added
* Rating

### Views

Support:

* list view
* grid view

The primary presentation must use book cards, not tables.

---

# 10. BOOK CARD

Create a reusable BookCard component.

Display:

* title
* author
* genre
* language
* status
* optional rating
* optional cover

Do not expose all database fields on cards.

The card should be visually lightweight.

---

# 11. BOOK DETAILS

Display:

* title
* author
* cover if available
* genre
* language
* status
* rating
* notes

Expandable book information:

* ISBN
* publisher
* publication year
* edition
* pages
* format
* date added

Actions:

```text
Edit Book
Delete Book
```

Delete requires explicit confirmation.

---

# 12. ADD BOOK — SCANNING

Create a dedicated barcode scanner screen.

Primary flow:

```text
Scan ISBN
     ↓
Barcode detected
     ↓
Extract ISBN
     ↓
Normalize ISBN
     ↓
Check duplicate
     ↓
New book / duplicate flow
```

The scanner must use the device camera.

Request camera permission only when the user actually starts scanning.

Do not request camera permission on application startup.

Handle:

* permission denied
* camera unavailable
* unsupported browser
* invalid barcode
* scanner cancellation

Provide:

```text
Scan Again
Enter ISBN Manually
Add Without ISBN
```

where appropriate.

---

# 13. ISBN HANDLING

Support:

* ISBN-10
* ISBN-13

Normalize ISBN before storing it.

Remove formatting such as:

```text
978-0-7352-1129-2
```

and store the normalized ISBN consistently.

Validate ISBN where possible.

Do not prevent books without ISBN from being added.

---

# 14. DUPLICATE DETECTION

Duplicate detection should occur server-side.

Never trust only client-side duplicate checking.

Flow:

```text
Client
  ↓
addBook request
  ↓
Apps Script
  ↓
Check ISBN
  ↓
Existing?
 ┌───────┴───────┐
 YES             NO
 │                │
 ▼                ▼
Return duplicate  Create record
```

The client should then display the appropriate duplicate UI.

Race conditions should be considered so two simultaneous add requests do not accidentally create unintended records.

---

# 15. ADD MANUALLY

Provide a manual-add path.

ISBN is optional.

Required:

* Title
* Author

Optional:

* Genre
* Language
* Status
* Rating
* Publisher
* Publication Year
* Edition
* Pages
* Format
* Notes

---

# 16. FORM DESIGN

Keep the main form short.

Essential fields:

```text
Title
Author
Genre
Language
Status
Rating
```

Expandable:

```text
More Details

ISBN
Publisher
Publication Year
Edition
Pages
Format
Notes
```

Do not expose Book ID as an editable field.

The user should never need to manage IDs.

---

# 17. DEFAULT VALUES

When adding a new book:

```text
Status = Unread
Rating = Not Rated
Date Added = server-generated current timestamp
```

Do not force the user to provide a rating.

---

# 18. STATUS VALUES

Use exactly:

```text
Unread
Reading
Read
On Hold
Abandoned
```

Status changes must be reflected immediately in the UI.

---

# 19. GENRES

Create a configurable `Genres` sheet.

Initial values:

```text
Fiction
Fantasy
Science Fiction
Mystery
Thriller
Horror
Romance
Historical Fiction
Literary Fiction
Biography
Autobiography
History
Philosophy
Psychology
Self Help
Science
Technology
Business
Politics
Religion
Travel
Poetry
Essays
Children
Comics
Other
```

The frontend should retrieve genres from the backend rather than hardcoding them.

This allows the user to modify the genre list directly in the Sheet.

---

# 20. GOOGLE SHEETS DATABASE

Create these tabs:

```text
Books
Genres
Settings
Reading History
```

## Books columns

Use:

```text
Book ID
ISBN
Title
Author
Genre
Language
Publisher
Publication Year
Edition
Pages
Format
Status
Rating
Date Added
Date Started
Date Finished
Notes
Cover URL
Updated At
```

Do not rely on column positions throughout the application.

Create a centralized schema/column mapping in Apps Script.

This makes future Sheet changes safer.

---

# 21. READING HISTORY

Maintain a `Reading History` tab.

Record meaningful status transitions.

Fields:

```text
Book ID
Previous Status
New Status
Changed At
```

Do not make this visible in V1 unless useful to the user.

The data should exist so reading-history features can be added later.

---

# 22. APPS SCRIPT API

Create a clean backend API abstraction.

Conceptually support:

```text
getBooks
getBook
searchBooks
getGenres
getStats
addBook
updateBook
deleteBook
changeStatus
```

Do not expose raw Sheet manipulation logic throughout the code.

Create a service/data-access layer.

The frontend should communicate with an API contract, not directly understand Google Sheets.

---

# 23. SECURITY — CRITICAL

This repository will be public on GitHub.

Treat all source code as publicly visible.

### NEVER commit:

* Google OAuth credentials
* Client secrets
* API keys
* private tokens
* Apps Script deployment secrets
* service-account JSON
* passwords
* refresh tokens
* spreadsheet IDs if they create unnecessary exposure
* private URLs containing authentication tokens

Use environment variables/configuration where appropriate.

Provide:

```text
.env.example
```

with placeholder values only.

Add secrets to `.gitignore`.

---

# 24. NEVER PUT SECRETS IN THE FRONTEND

Anything shipped to the browser is public.

Therefore:

```text
WRONG:

React frontend
   ↓
Google secret
   ↓
Google Sheets
```

Never do this.

Instead:

```text
React
  ↓
Apps Script
  ↓
Google Sheets
```

Google credentials/authorization must remain on the Apps Script/Google side.

---

# 25. APPS SCRIPT SECURITY

Do not blindly trust incoming requests.

Validate every mutation server-side.

For `addBook`, validate:

* title
* author
* ISBN
* genre
* language
* status
* rating
* dates
* string lengths

For `updateBook`, validate both:

* Book ID
* supplied fields

For `deleteBook`, validate Book ID.

Never allow arbitrary spreadsheet ranges or formulas to be supplied by the client.

---

# 26. GOOGLE SHEETS FORMULA INJECTION

Treat all user-provided strings as untrusted.

This is especially important because book titles, author names, notes, etc. may begin with characters such as:

```text
=
+
-
@
```

Do not accidentally allow user input to become a spreadsheet formula.

Sanitize/escape values appropriately before writing them to Sheets.

Do not use user-provided input to construct spreadsheet formulas.

---

# 27. XSS PROTECTION

Book data is user-controlled data.

Never inject book titles, notes, authors, or other values using unsafe HTML mechanisms.

Do not use:

```javascript
innerHTML = userInput
```

unless there is an explicit, safe sanitization strategy.

Use React's normal escaped rendering.

If rich text is ever introduced later, sanitize it properly.

---

# 28. INPUT LIMITS

Add sensible limits to prevent abuse and accidental oversized requests.

For example:

```text
Title       ≤ 300 characters
Author      ≤ 300 characters
Publisher   ≤ 300 characters
Genre       ≤ 100 characters
Language    ≤ 100 characters
Notes       ≤ 5000 characters
ISBN        reasonable ISBN length
```

Reject malformed requests server-side.

---

# 29. API ABUSE PROTECTION

Because Apps Script endpoints can potentially be exposed publicly, do not assume that hiding the URL is security.

Implement appropriate access control for the chosen Apps Script deployment model.

Where practical:

* restrict access to the intended Google account/user
* validate authenticated identity server-side
* reject unauthorized requests
* avoid exposing unnecessary backend functionality
* do not provide arbitrary spreadsheet read/write endpoints

The client must never be able to specify arbitrary Sheet IDs, ranges, or operations.

---

# 30. CORS

Configure access deliberately.

Do not use broad permissive CORS policies unnecessarily.

Avoid blindly allowing:

```text
*
```

for privileged APIs where a narrower configuration is possible.

If the Apps Script deployment model imposes limitations, document the limitation and compensate with authentication/authorization controls.

---

# 31. AUTHENTICATION

Do not create a custom username/password system.

Prefer Google's existing identity/authentication mechanisms compatible with Apps Script.

The objective is:

```text
Authorized user
       ↓
Spine
       ↓
Apps Script
       ↓
Google Sheet
```

Do not store passwords in the project.

Do not create an authentication database.

---

# 32. DATA ACCESS

The user should only be able to access their own library.

Do not design the API as a multi-tenant public database.

The Apps Script should operate against the intended spreadsheet only.

Do not allow the frontend to provide a spreadsheet ID.

---

# 33. ERROR HANDLING

Never expose sensitive backend errors to users.

Bad:

```text
Exception: SpreadsheetApp.openById(...)
```

Good:

```text
Something went wrong.
Please try again.
```

Log useful diagnostic information server-side without exposing secrets.

Frontend errors should be human-readable.

---

# 34. NETWORK FAILURE

Handle:

* API timeout
* network failure
* Apps Script unavailable
* malformed backend response
* rate/quota errors

Display appropriate retry states.

Do not silently lose a book submission.

For an unsuccessful save:

```text
Book wasn't added.

[ Try Again ]
```

---

# 35. DELETE SAFETY

Deleting a book must require confirmation.

Example:

```text
Delete this book?

This will remove the book from your library.

[Cancel] [Delete]
```

Do not delete immediately from a single accidental tap.

---

# 36. DATA INTEGRITY

All important database mutations happen through Apps Script.

The frontend should never directly manipulate Google Sheets.

Server-side responsibilities:

* generate Book ID
* validate fields
* normalize ISBN
* detect duplicates
* write records
* update records
* delete records
* record reading history
* calculate authoritative statistics where appropriate

---

# 37. BOOK ID GENERATION

Generate IDs server-side.

Preferred format:

```text
BK-00001
BK-00002
BK-00003
```

Do not calculate the next ID merely from:

```text
number of rows + 1
```

because deleted rows can cause collisions.

Use a safe mechanism such as a stored counter in Settings/PropertiesService, with appropriate locking.

Apps Script `LockService` should be considered when generating IDs or performing operations vulnerable to concurrent requests.

---

# 38. CONCURRENCY

Apps Script operations can overlap.

Protect critical operations such as:

* Book ID generation
* duplicate detection + insertion

against concurrent requests.

Use server-side locking where necessary.

---

# 39. PERFORMANCE

Do not repeatedly read the entire Sheet for every operation if unnecessary.

Avoid:

```text
API request
 ↓
Read entire spreadsheet
 ↓
Process everything
 ↓
Return everything
```

Use efficient batch reads/writes.

Keep API responses reasonably small.

For a personal library, optimize for simplicity but don't write obviously inefficient Sheet code.

---

# 40. FRONTEND STATE

Keep the frontend architecture clean.

Separate:

```text
UI
↓
state/hooks
↓
API client
↓
Apps Script
```

Don't scatter `fetch()` calls throughout components.

Create a centralized API client/service.

---

# 41. TYPES

Use TypeScript types for:

```text
Book
BookStatus
Genre
ReadingHistoryEntry
LibraryStats
API response types
```

Keep frontend/backend data contracts explicit.

Avoid `any` unless genuinely necessary.

---

# 42. PWA

Make Spine installable as a PWA.

Include:

* manifest
* app icon setup
* responsive viewport
* service worker where appropriate
* installable mobile experience

The app should feel like a native mobile application when installed.

Do not make offline database synchronization a V1 requirement.

---

# 43. CAMERA / BARCODE LIBRARY

Choose a mature open-source browser barcode-scanning library that supports mobile cameras.

Prefer a library with:

* active maintenance
* permissive license
* browser support
* ISBN/EAN barcode support

Do not implement barcode recognition from scratch.

Do not upload camera images to a third-party service.

Barcode processing should happen locally in the browser whenever possible.

---

# 44. CAMERA PRIVACY

Camera access should:

* only start when scanning begins
* stop when leaving the scanner
* stop after successful scan
* not capture/store images
* not upload camera frames anywhere

Explain camera permission naturally if required.

---

# 45. COVER IMAGES

Covers are optional.

Do NOT introduce a book metadata API.

The application must work perfectly without covers.

The existing database includes:

```text
Cover URL
```

but V1 does not require automatic cover retrieval.

Future manual cover upload can use Google Drive.

---

# 46. STATS

Calculate:

* total books
* unread
* reading
* read
* on hold
* abandoned
* genre count
* language count

Stats must be based on actual library data.

Avoid overengineering the analytics.

The visual style should feel like a personal collection overview, not a business analytics dashboard.

---

# 47. ACCESSIBILITY

Implement:

* semantic HTML
* keyboard accessibility
* visible focus states
* sufficient contrast
* accessible labels
* proper button semantics
* accessible form errors
* camera permission/error messaging
* touch targets large enough for mobile

Do not use icons as the only indication of important actions.

---

# 48. LOADING STATES

Every network-dependent screen should have an intentional loading state.

Avoid blank screens.

Use:

* skeletons
* subtle loading indicators
* disabled button states

depending on the UI design.

---

# 49. EMPTY STATES

Design according to the provided UI.

For an empty library:

```text
Your library is empty

Start adding the books you own.

[Scan Your First Book]
```

Make it visually polished.

---

# 50. NOTIFICATIONS / FEEDBACK

Use lightweight feedback for successful actions:

```text
Added to your library
Book updated
Book deleted
Status updated
```

Do not overuse modal dialogs.

---

# 51. NO HARDCODED MOCK DATA IN PRODUCTION UI

During development, mock data can be used temporarily.

Before finalizing:

* remove mock library records
* remove fake statistics
* remove placeholder API responses
* connect all production views to real Apps Script APIs

The UI must work with an empty database.

---

# 52. ENVIRONMENT CONFIGURATION

The repository must be safe to publish publicly.

Create:

```text
.env.example
```

Document required configuration without putting real secrets into Git.

Example:

```text
VITE_APPS_SCRIPT_URL=
```

Do not commit `.env`.

Use `.gitignore`.

If Apps Script deployment URLs are considered non-secret public endpoints, they may be documented separately, but never embed credentials/tokens in them.

---

# 53. README

Create a professional README covering:

## Spine

Personal library management app.

### Features

* Barcode scanning
* ISBN capture
* Manual book entry
* Duplicate detection
* Individual physical-copy tracking
* Search
* Filters
* Reading status
* Ratings
* Notes
* Statistics
* PWA

### Architecture

```text
React PWA
    ↓
Google Apps Script
    ↓
Google Sheets
```

### Local development

Explain exactly how to:

1. clone
2. install
3. configure environment
4. run locally

### Google Apps Script setup

Explain:

1. creating the spreadsheet
2. creating required tabs
3. deploying Apps Script
4. configuring access
5. connecting the frontend

Do NOT put any private deployment credentials in README.

### Security

Document which configuration values are secrets and how they should be supplied.

---

# 54. GOOGLE APPS SCRIPT PROJECT

Keep Apps Script code organized.

Suggested structure:

```text
apps-script/
├── Code.gs
├── Config.gs
├── Books.gs
├── Genres.gs
├── Stats.gs
├── Validation.gs
├── Security.gs
└── Utils.gs
```

If Apps Script's deployment structure makes this inconvenient, use the closest clean organization supported by the environment.

Avoid one enormous `Code.gs`.

---

# 55. FRONTEND STRUCTURE

Use a clean structure such as:

```text
src/
├── components/
├── pages/
├── features/
│   ├── books/
│   ├── scanner/
│   ├── library/
│   └── stats/
├── services/
├── hooks/
├── types/
├── utils/
├── styles/
└── app/
```

Adapt this to the existing repository rather than blindly enforcing it.

---

# 56. COMPONENTS

Create reusable components for:

* BookCard
* SearchBar
* FilterChip
* StatusChip
* Rating
* Button
* FormField
* Select
* BottomNavigation
* Modal
* EmptyState
* LoadingState
* ErrorState

Avoid duplicating styles and logic between screens.

---

# 57. DESIGN TOKENS

Centralize:

* colors
* typography
* spacing
* radii
* shadows
* transitions

The UI should feel consistent.

Do not randomly assign different border radii or spacing values throughout the application.

---

# 58. ANIMATION

Use subtle animation only where it improves the experience.

Good:

* card press
* modal appearance
* scanner success
* filter transitions
* status changes

Avoid:

* excessive bouncing
* unnecessary page animations
* distracting loading effects

Respect `prefers-reduced-motion`.

---

# 59. SECURITY REVIEW BEFORE COMPLETION

Before considering the implementation complete, inspect the entire repository for:

```text
API_KEY
SECRET
PASSWORD
TOKEN
CLIENT_SECRET
PRIVATE_KEY
ACCESS_TOKEN
REFRESH_TOKEN
```

Also check:

* `.env`
* source files
* config files
* README
* test fixtures
* sample data
* Git history if appropriate

Ensure no real secret is committed.

Also review:

* XSS
* formula injection
* unauthorized API access
* arbitrary Sheet access
* unsafe CORS
* input validation
* delete authorization
* duplicate handling
* race conditions
* error leakage

---

# 60. TESTING

Implement tests for important logic.

At minimum test:

### ISBN

* ISBN-10
* ISBN-13
* formatted ISBN
* invalid ISBN
* missing ISBN

### Book

* valid book
* missing title
* missing author
* invalid rating
* invalid status
* oversized notes

### Duplicate

* existing ISBN
* new ISBN
* duplicate ISBN with another physical copy

### IDs

* sequential creation
* deletion followed by creation
* concurrent creation if testable

### API

* successful request
* unauthorized request
* malformed request
* backend failure

---

# 61. DEVELOPMENT ORDER

Do not attempt to build everything at once.

Implement in this order:

### Phase 1 — Foundation

* inspect repository
* establish project structure
* implement design system
* implement routing/navigation
* implement responsive shell

### Phase 2 — Library UI

* Home
* Library
* Book Card
* Book Details
* Search
* Filters
* Stats

Use temporary local data only while UI is being built.

### Phase 3 — Apps Script backend

* Sheets schema
* validation
* Book ID generation
* API endpoints
* duplicate detection
* security

### Phase 4 — Connect frontend

* replace mock data
* connect library
* connect stats
* add/edit/delete
* status updates

### Phase 5 — Scanner

* camera permissions
* barcode scanning
* ISBN normalization
* duplicate flow
* manual fallback

### Phase 6 — PWA

* manifest
* icons
* installability
* service worker

### Phase 7 — Testing/security review

* test flows
* test mobile
* test failure states
* security audit
* remove development artifacts

---

# 62. IMPORTANT: DON'T OVERENGINEER

This is a personal library.

Do NOT introduce:

* Redux unless genuinely necessary
* complex state management
* microservices
* database abstraction frameworks
* unnecessary backend servers
* complex authentication systems
* external metadata providers
* AI categorization
* unnecessary dependencies

Prefer simple, maintainable code.

---

# 63. FINAL QUALITY BAR

When complete, Spine should feel like a polished consumer mobile application.

It should feel:

**Personal**
**Fast**
**Calm**
**Modern**
**Book-focused**
**Simple**

It should not feel like:

**ERP**
**CRUD**
**Admin panel**
**Spreadsheet**
**Database management software**

The user should be able to perform the primary task:

```text
Take book
   ↓
Open Spine
   ↓
Scan
   ↓
Enter basic information
   ↓
Add
```

in as few steps as reasonably possible.

---

# 64. FINAL IMPLEMENTATION REQUIREMENT

After implementation:

1. Run the application.
2. Test every major screen.
3. Test mobile dimensions.
4. Test the scanner flow where possible.
5. Test empty library.
6. Test adding a book.
7. Test duplicate ISBN.
8. Test adding a second physical copy.
9. Test editing.
10. Test deleting.
11. Test search.
12. Test filters.
13. Test statistics.
14. Test backend failure.
15. Review security.
16. Remove all secrets and mock data.
17. Run the project's lint/typecheck/tests.
18. Fix all errors before finishing.

Do not merely create the UI.

Build the application as a functioning end-to-end product using the architecture specified above.

When a design detail is already established by the provided UI, follow the design rather than inventing a different pattern.

When a technical decision is unspecified, choose the simplest secure implementation that preserves the architecture and future extensibility of Spine.
