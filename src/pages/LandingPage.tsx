import { Link } from 'react-router-dom'
import { Icon } from '@/components'
import styles from './LandingPage.module.css'

const REPO_SLUG = 'muhammed-ziyan/spine-personal-library-manager'
const REPO = `https://github.com/${REPO_SLUG}`

/** The three books shown on the phone mock — illustration only, not real data. */
const RECENT = [
  { title: 'Atomic Habits', author: 'James Clear', status: 'Unread', cover: 'var(--color-accent-700)' },
  { title: 'Braiding Sweetgrass', author: 'Robin Wall Kimmerer', status: 'Reading', cover: 'var(--color-accent-2-700)' },
  { title: 'Sapiens', author: 'Yuval Noah Harari', status: 'Read', cover: 'var(--color-accent-300)' },
] as const

const CHIP: Record<string, { background: string; color: string }> = {
  Unread: { background: 'var(--status-unread-bg)', color: 'var(--status-unread-ink)' },
  Reading: { background: 'var(--status-reading-bg)', color: 'var(--status-reading-ink)' },
  Read: { background: 'var(--status-read-bg)', color: 'var(--status-read-ink)' },
}

/** The GitHub mark. Filled, so it does not fit the app's stroked Icon set. */
function GitHubMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/** The three-bar Spine mark, drawn inline so the landing page needs no assets. */
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={[styles.mark, small && styles.markSm].filter(Boolean).join(' ')} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

/**
 * The public landing page, shown at `/` to anyone without a session. It is the
 * marketing face of Spine — the app itself lives behind /signin — so it is the
 * only screen that breaks out of the phone-width column.
 */
export function LandingPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.brand}>
          <Mark />
          <span className={styles.wordmark}>Spine</span>
        </span>
        <a className={styles.navLink} href="#how">
          How it works
        </a>
        <a className={styles.navLink} href="#why">
          Why Spine
        </a>
        <a className={styles.navLink} href="#source">
          Source
        </a>
        <Link className={[styles.btn, styles.btnPrimary, styles.btnNav].join(' ')} to="/signin">
          Get Spine
        </Link>
      </nav>

      <div className={styles.shell}>
        {/* ---- Hero ---- */}
        <section className={styles.hero}>
          <span className={styles.heroBlob} aria-hidden="true" />
          <div>
            <h1 className={styles.heroTitle}>
              <span>Every book you own.</span>
              <span>One shelf in your pocket.</span>
            </h1>
            <p className={styles.heroLead}>
              Spine keeps track of the books on your shelves. Scan the back of a book and it&apos;s in your library,
              along with whether you&apos;ve read it and what you thought.
            </p>
            <div className={styles.heroActions}>
              <Link className={[styles.btn, styles.btnPrimary, styles.btnLg].join(' ')} to="/signin">
                <Icon name="scan" size={20} />
                Get Spine, free
              </Link>
              <a className={[styles.btn, styles.btnGhost, styles.btnLg].join(' ')} href="#how">
                See how it works
              </a>
            </div>
            <div className={styles.heroNote}>Works on your phone · Your own private library</div>
          </div>

          <div className={styles.phone} aria-hidden="true">
            <div className={styles.phoneBody}>
              <div className={styles.phoneStatus}>
                <span>9:41</span>
                <span className={styles.phoneBattery} />
              </div>
              <div className={styles.phoneBrand}>
                <Mark small />
                Spine
              </div>

              <div className={styles.phoneCard}>
                <span className={styles.phoneCardBlob} />
                <div className={styles.phoneCardInner}>
                  <div className={styles.phoneLabel}>Your collection</div>
                  <div className={styles.phoneCount}>
                    127 <small>books</small>
                  </div>
                  <div className={styles.phoneLabel}>42 read · 3 reading · 82 unread</div>
                  <div className={styles.phoneBar}>
                    <span style={{ flex: 42, background: 'var(--color-accent-2-500)' }} />
                    <span style={{ flex: 3, background: 'var(--color-accent)' }} />
                    <span style={{ flex: 82, background: 'var(--color-neutral-300)' }} />
                  </div>
                </div>
              </div>

              <div className={[styles.btn, styles.btnPrimary, styles.phoneScanBtn].join(' ')}>
                <Icon name="scan" size={16} />
                Scan a Book
              </div>

              <div className={styles.phoneList}>
                {RECENT.map((book) => (
                  <div className={styles.phoneRow} key={book.title}>
                    <span className={styles.phoneCover} style={{ background: book.cover }} />
                    <div className={styles.phoneRowText}>
                      <div className={styles.phoneTitle}>{book.title}</div>
                      <div className={styles.phoneAuthor}>{book.author}</div>
                    </div>
                    <span className={styles.phoneChip} style={CHIP[book.status]}>
                      {book.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.phoneNav}>
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </section>

        {/* ---- How it works ---- */}
        <section className={styles.how} id="how">
          <span className={styles.kicker}>How it works</span>
          <h2 className={styles.sectionTitle}>Three steps. About three seconds.</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNumber}>1</span>
              <h3 className={styles.stepTitle}>Scan the back</h3>
              <p className={styles.stepBody}>
                Point your phone at the barcode. The title, author and cover appear on their own.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <h3 className={styles.stepTitle}>Say how it went</h3>
              <p className={styles.stepBody}>
                Read it, reading it, or still waiting? Give it stars if you like. Skip anything you don&apos;t feel like
                filling in.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <h3 className={styles.stepTitle}>Find it anytime</h3>
              <p className={styles.stepBody}>
                Search by title or author, browse by what you haven&apos;t read yet, and see your whole collection at a
                glance.
              </p>
            </div>
          </div>
        </section>

        {/* ---- Adding books ---- */}
        <section className={styles.split}>
          <div className={styles.scanner} aria-hidden="true">
            <span className={styles.scannerGlow} />
            <div className={styles.scannerTitle}>Scan a Book</div>
            <div className={styles.scannerStage}>
              <div className={styles.reticle}>
                <i />
                <i />
                <i />
                <i />
                <span className={styles.barcode} />
                <span className={styles.laser} />
              </div>
              <div className={styles.scannerHint}>Point your camera at the barcode on the back of the book.</div>
            </div>
            <div className={styles.scannerToast}>
              <span className={styles.scannerTick}>
                <Icon name="check" size={14} />
              </span>
              <div>
                <div className={styles.phoneLabel}>Found it</div>
                <div className={styles.scannerFound}>Atomic Habits</div>
              </div>
            </div>
          </div>
          <div>
            <span className={styles.kicker}>Adding books</span>
            <h2 className={styles.splitTitle}>A whole shelf in the time it takes to make tea.</h2>
            <p className={styles.splitBody}>
              Keep scanning, book after book. Each one lands with a little &ldquo;Added to your library&rdquo;. Already
              own it? Spine tells you, and lets you add a second copy if you really do have two. Old books without a
              barcode can be typed in by hand.
            </p>
          </div>
        </section>

        {/* ---- Why Spine ---- */}
        <section className={styles.why} id="why">
          <span className={styles.kicker}>Why Spine</span>
          <h2 className={styles.sectionTitle}>A library, not a spreadsheet.</h2>
          <div className={styles.reasons}>
            <div className={styles.reason}>
              <div className={styles.statusRow} aria-hidden="true">
                <span className={styles.statusPill} style={CHIP.Unread}>
                  Unread
                </span>
                <span className={styles.statusPill} style={CHIP.Reading}>
                  Reading
                </span>
                <span className={styles.statusPill} style={CHIP.Read}>
                  Read
                </span>
              </div>
              <h3 className={styles.reasonTitle}>Know what&apos;s waiting</h3>
              <p className={styles.reasonBody}>
                See at a glance what you&apos;ve finished, what you&apos;re in the middle of, and what&apos;s still on
                the pile.
              </p>
            </div>
            <div className={styles.reason}>
              <div className={styles.stars} aria-hidden="true">
                ★★★★<span>☆</span>
              </div>
              <h3 className={styles.reasonTitle}>Remember what you thought</h3>
              <p className={styles.reasonBody}>
                A star rating and a line or two of notes, so the good ones don&apos;t blur together.
              </p>
            </div>
            <div className={styles.reason}>
              <div className={styles.bars} aria-hidden="true">
                <span style={{ width: 40, background: 'var(--color-accent)' }} />
                <span style={{ width: 24, background: 'var(--color-accent-2-500)' }} />
                <span style={{ width: 18, background: 'var(--color-accent-400)' }} />
                <span style={{ width: 12, background: 'var(--color-neutral-400)' }} />
              </div>
              <h3 className={styles.reasonTitle}>See your collection take shape</h3>
              <p className={styles.reasonBody}>
                How many books, how many read, and which kinds you lean towards. Set a yearly goal if you want a nudge.
              </p>
            </div>
            <div className={styles.reason}>
              <div className={styles.themeDots} aria-hidden="true">
                <span />
                <span />
              </div>
              <h3 className={styles.reasonTitle}>Easy on the eyes</h3>
              <p className={styles.reasonBody}>Warm and light by day, soft and dark for reading in bed.</p>
            </div>
          </div>
        </section>

        {/* ---- Open source ---- */}
        <section className={styles.oss} id="source">
          <span className={styles.kicker}>Open source</span>
          <div className={styles.ossGrid}>
            <div>
              <h2 className={styles.ossTitle}>Built in the open. Run your own.</h2>
              <p className={styles.ossBody}>
                Spine is MIT-licensed, front to back. The app is a React PWA; the backend is a Google Apps Script web
                app in front of a Google Sheet you own — so there is no server to rent and no database to keep alive.
                Clone it, point it at your own sheet, and it is yours.
              </p>
              <div className={styles.ossActions}>
                <a
                  className={[styles.btn, styles.btnPrimary, styles.btnLg].join(' ')}
                  href={REPO}
                  target="_blank"
                  rel="noreferrer"
                >
                  <GitHubMark />
                  View on GitHub
                </a>
                <a
                  className={[styles.btn, styles.btnSecondary, styles.btnLg].join(' ')}
                  href={`${REPO}#deploy-your-own`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the setup guide
                </a>
              </div>
            </div>

            <div>
              <dl className={styles.specs}>
                <div className={styles.specRow}>
                  <dt>Repository</dt>
                  <dd>
                    <a href={REPO} target="_blank" rel="noreferrer">
                      github.com/{REPO_SLUG}
                    </a>
                  </dd>
                </div>
                <div className={styles.specRow}>
                  <dt>Licence</dt>
                  <dd>MIT — fork it, ship it, sell it.</dd>
                </div>
                <div className={styles.specRow}>
                  <dt>Frontend</dt>
                  <dd>React 18 · TypeScript · Vite · CSS Modules · installable PWA</dd>
                </div>
                <div className={styles.specRow}>
                  <dt>Backend</dt>
                  <dd>Google Apps Script (V8) over Google Sheets</dd>
                </div>
                <div className={styles.specRow}>
                  <dt>Your data</dt>
                  <dd>A spreadsheet in your own Drive. Barcodes are decoded on-device.</dd>
                </div>
                <div className={styles.specRow}>
                  <dt>Issues</dt>
                  <dd>
                    <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">
                      Bugs and ideas welcome
                    </a>
                  </dd>
                </div>
              </dl>
              <pre className={styles.clone}>
                <code>
                  <span className={styles.clonePrompt}>$ </span>git clone {REPO}.git
                  {'\n'}
                  <span className={styles.clonePrompt}>$ </span>npm install &amp;&amp; npm run dev
                </code>
              </pre>
            </div>
          </div>
        </section>

        {/* ---- Closing call to action ---- */}
        <section className={styles.close}>
          <div className={styles.closeCard}>
            <div>
              <h3 className={styles.closeTitle}>Start with the shelf nearest you.</h3>
              <p className={styles.closeBody}>
                Spine is free. Open it on your phone and scan your first book in under a minute.
              </p>
            </div>
            <div className={styles.closeActions}>
              <Link className={[styles.btn, styles.btnPrimary, styles.btnLg].join(' ')} to="/signin">
                Get Spine
              </Link>
              <a className={[styles.btn, styles.btnSecondary, styles.btnLg].join(' ')} href="#how">
                See the app
              </a>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <span className={styles.footerBrand}>Spine</span>
          <a href="#how">How it works</a>
          <a href="#why">Why Spine</a>
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span>MIT licensed</span>
          <Link to="/signin">Sign in</Link>
        </footer>
      </div>
    </main>
  )
}
