import { Link } from 'react-router-dom'
import { BookCard, BookCardSkeleton, Button, EmptyState, ErrorState, Icon, Skeleton } from '@/components'
import { useAuth } from '@/hooks/useAuth'
import { useLibrary } from '@/hooks/useLibrary'
import { describeError } from '@/services/api'
import { BOOK_STATUSES, type BookStatus } from '@/types'
import { pluralize } from '@/utils/format'
import { AccountMenu } from '@/app/AccountMenu'
import styles from './HomePage.module.css'

const statusTone: Record<BookStatus, string> = {
  Unread: styles.toneUnread,
  Reading: styles.toneReading,
  Read: styles.toneRead,
  'On Hold': styles.toneOnHold,
  Abandoned: styles.toneAbandoned,
}

export function HomePage() {
  const { books, stats, state, error, refresh } = useLibrary()
  const { session } = useAuth()
  const firstName = session?.user.name?.split(' ')[0]

  const loading = state === 'loading' || state === 'idle'
  const total = stats?.total ?? books.length
  const recent = books.slice(0, 5)

  if (state === 'error' && error) {
    return (
      <main className="page">
        <header className={styles.hero}>
          <div className={styles.heroRow}>
            <div>
              <p className="page-eyebrow">Spine</p>
              <h1 className={styles.title}>Your library</h1>
            </div>
            <AccountMenu />
          </div>
        </header>
        <ErrorState title="Couldn't load your library" message={describeError(error)} onRetry={() => void refresh()} />
      </main>
    )
  }

  return (
    <main className="page">
      <header className={styles.hero}>
        <div className={styles.heroRow}>
          <div>
            <p className="page-eyebrow">{firstName ? `Hi ${firstName}, this is your library` : 'Your library'}</p>
            {loading ? (
              <Skeleton width="10rem" height="2.6rem" radius="var(--radius-md)" />
            ) : (
              <h1 className={styles.title}>
                <span className={styles.count}>{total}</span> {total === 1 ? 'Book' : 'Books'}
              </h1>
            )}
          </div>
          <AccountMenu />
        </div>
        {!loading && stats && total > 0 && (
          <p className={styles.summary}>
            <span>
              <strong>{stats.byStatus.Read}</strong> Read
            </span>
            <span className={styles.dot} aria-hidden="true" />
            <span>
              <strong>{stats.byStatus.Reading}</strong> Reading
            </span>
            <span className={styles.dot} aria-hidden="true" />
            <span>
              <strong>{stats.byStatus.Unread}</strong> Unread
            </span>
          </p>
        )}
      </header>

      {!loading && total === 0 ? (
        <EmptyState
          icon="book"
          title="Your library is empty"
          description="Start adding the books you own."
          action={
            <>
              <Button to="/scan" icon="scan" size="lg">
                Scan Your First Book
              </Button>
              <Button to="/books/new" variant="ghost">
                Add manually instead
              </Button>
            </>
          }
        />
      ) : (
        <>
          <section className={styles.actions} aria-label="Add a book">
            <Button to="/scan" icon="scan" size="lg" block>
              Scan Book
            </Button>
            <Button to="/books/new" variant="secondary" icon="pencil" size="lg" block>
              Add Manually
            </Button>
          </section>

          <section className="section" aria-labelledby="status-heading">
            <h2 id="status-heading" className="section-title">
              Reading status
            </h2>
            <ul className={styles.statusList}>
              {BOOK_STATUSES.map((status) => {
                const count = stats?.byStatus[status] ?? 0
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <li key={status}>
                    <Link to={`/library?status=${encodeURIComponent(status)}`} className={styles.statusRow}>
                      <span className={[styles.statusSwatch, statusTone[status]].join(' ')} aria-hidden="true" />
                      <span className={styles.statusName}>{status}</span>
                      <span className={styles.statusBar} aria-hidden="true">
                        <span className={[styles.statusFill, statusTone[status]].join(' ')} style={{ width: `${pct}%` }} />
                      </span>
                      <span className={styles.statusCount}>{loading ? <Skeleton width="1.5rem" height="0.9rem" /> : count}</span>
                      <Icon name="chevron-right" size={16} className={styles.chevron} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="section" aria-labelledby="recent-heading">
            <div className={styles.sectionHeader}>
              <h2 id="recent-heading" className="section-title">
                Recently added
              </h2>
              {books.length > 5 && (
                <Link to="/library" className={styles.seeAll}>
                  See all {pluralize(books.length, 'book')}
                </Link>
              )}
            </div>
            {loading ? (
              <BookCardSkeleton count={3} />
            ) : (
              <ul className="stack">
                {recent.map((book) => (
                  <li key={book.id}>
                    <BookCard book={book} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
