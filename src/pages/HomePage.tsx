import { Link } from 'react-router-dom'
import { Avatar, BookCard, BookCardSkeleton, Button, EmptyState, ErrorState, Logo, PageHeader, Skeleton } from '@/components'
import { useAuth } from '@/hooks/useAuth'
import { useLibrary } from '@/hooks/useLibrary'
import { describeError } from '@/services/api'
import styles from './HomePage.module.css'

export function HomePage() {
  const { books, stats, state, error, refresh } = useLibrary()
  const { session } = useAuth()

  const loading = state === 'loading' || state === 'idle'
  const total = stats?.total ?? books.length
  const read = stats?.byStatus.Read ?? 0
  const reading = stats?.byStatus.Reading ?? 0
  const unread = stats?.byStatus.Unread ?? 0
  const recent = books.slice(0, 3)

  const header = (
    <PageHeader
      display
      title="Spine"
      leading={<Logo />}
      actions={
        <Link to="/you" className={styles.avatarLink} aria-label="You">
          <Avatar name={session?.user.name} picture={session?.user.picture} />
        </Link>
      }
    />
  )

  if (state === 'error' && error) {
    return (
      <main className={['page', 'page--nav', styles.home].join(' ')}>
        {header}
        <ErrorState title="Couldn't load your library" message={describeError(error)} onRetry={() => void refresh()} />
      </main>
    )
  }

  if (!loading && total === 0) {
    return (
      <main className={['page', 'page--nav', styles.home].join(' ')}>
        <PageHeader display title="Spine" />
        <EmptyState
          illustration
          title="Your Spine is empty"
          description="Start adding the books you own. Scanning takes a few seconds per book."
          action={
            <>
              <Button to="/scan" icon="scan" size="xl" block>
                Scan Your First Book
              </Button>
              <Button to="/books/new" variant="ghost" block>
                Add Manually
              </Button>
            </>
          }
        />
      </main>
    )
  }

  return (
    <main className={['page', 'page--nav', styles.home].join(' ')}>
      {header}

      <section className={styles.hero} aria-label="Your collection">
        <span className={styles.blob1} aria-hidden="true" />
        <span className={styles.blob2} aria-hidden="true" />
        <div className={styles.heroBody}>
          <div className={styles.heroLabel}>Your collection</div>
          {loading ? (
            <Skeleton width="180px" height="58px" radius="16px" className={styles.heroSkeleton} />
          ) : (
            <div className={styles.heroNumber}>
              {total} <span className={styles.heroUnit}>{total === 1 ? 'book' : 'books'}</span>
            </div>
          )}
          <div className={styles.heroSummary}>{loading ? 'Counting your shelves…' : `${read} read · ${reading} reading · ${unread} unread`}</div>
          <div className={styles.heroBar} aria-hidden="true">
            {loading ? (
              <span className={styles.segUnread} style={{ flex: 1 }} />
            ) : (
              <>
                {read > 0 && <span className={styles.segRead} style={{ flex: read }} />}
                {reading > 0 && <span className={styles.segReading} style={{ flex: reading }} />}
                {unread > 0 && <span className={styles.segUnread} style={{ flex: unread }} />}
                {read + reading + unread === 0 && <span className={styles.segUnread} style={{ flex: 1 }} />}
              </>
            )}
          </div>
        </div>
      </section>

      <section className={styles.actions} aria-label="Add a book">
        <Button to="/scan" icon="scan" size="xl" block>
          Scan a Book
        </Button>
        <Button to="/books/new" variant="secondary" block>
          Add Manually
        </Button>
      </section>

      <section className={styles.tiles} aria-label="Reading status">
        <Link to="/library?status=Unread" className={styles.tile}>
          <span className={styles.tileValue}>{loading ? '–' : unread}</span>
          <span className={styles.tileLabel}>Unread</span>
        </Link>
        <Link to="/library?status=Reading" className={[styles.tile, styles.tileReading].join(' ')}>
          <span className={styles.tileValue}>{loading ? '–' : reading}</span>
          <span className={styles.tileLabel}>Reading</span>
        </Link>
        <Link to="/library?status=Read" className={[styles.tile, styles.tileRead].join(' ')}>
          <span className={styles.tileValue}>{loading ? '–' : read}</span>
          <span className={styles.tileLabel}>Read</span>
        </Link>
      </section>

      <section className={styles.recent} aria-labelledby="recent-heading">
        <div className="section-header">
          <h2 id="recent-heading" className="section-title">
            Recently added
          </h2>
          <Link to="/library" className="section-link">
            See all
          </Link>
        </div>
        {loading ? (
          <BookCardSkeleton count={3} />
        ) : (
          <ul className="stack">
            {recent.map((book) => (
              <li key={book.id}>
                <BookCard book={book} genreOnly />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
