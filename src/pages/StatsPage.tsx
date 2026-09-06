import { Link } from 'react-router-dom'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components'
import { useLibrary } from '@/hooks/useLibrary'
import { describeError } from '@/services/api'
import { BOOK_STATUSES, type BookStatus } from '@/types'
import { pluralize } from '@/utils/format'
import styles from './StatsPage.module.css'

const statusTone: Record<BookStatus, string> = {
  Unread: styles.toneUnread,
  Reading: styles.toneReading,
  Read: styles.toneRead,
  'On Hold': styles.toneOnHold,
  Abandoned: styles.toneAbandoned,
}

function topEntries(record: Record<string, number>, limit = 8): Array<[string, number]> {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
}

export function StatsPage() {
  const { stats, state, error, refresh } = useLibrary()
  const loading = state === 'loading' || state === 'idle'

  if (state === 'error' && error) {
    return (
      <main className="page">
        <PageHeader title="Stats" display />
        <ErrorState title="Couldn't load your stats" message={describeError(error)} onRetry={() => void refresh()} />
      </main>
    )
  }

  if (loading || !stats) {
    return (
      <main className="page" aria-busy="true">
        <PageHeader title="Stats" display />
        <div className={styles.tiles}>
          <Skeleton height="6rem" radius="var(--radius-xl)" />
          <Skeleton height="6rem" radius="var(--radius-xl)" />
        </div>
        <Skeleton height="14rem" radius="var(--radius-xl)" />
      </main>
    )
  }

  if (stats.total === 0) {
    return (
      <main className="page">
        <PageHeader title="Stats" display />
        <EmptyState
          icon="stats"
          title="Nothing to count yet"
          description="Your reading stats will appear here once you add a few books."
          action={
            <Button to="/scan" icon="scan" size="lg">
              Scan Your First Book
            </Button>
          }
        />
      </main>
    )
  }

  const genres = topEntries(stats.byGenre)
  const languages = topEntries(stats.byLanguage)
  const genreCount = Object.keys(stats.byGenre).length
  const languageCount = Object.keys(stats.byLanguage).length
  const readPct = Math.round((stats.byStatus.Read / stats.total) * 100)

  return (
    <main className="page">
      <PageHeader title="Stats" display eyebrow="Your collection at a glance" />

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{stats.total}</span>
          <span className={styles.tileLabel}>{stats.total === 1 ? 'Book owned' : 'Books owned'}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{readPct}%</span>
          <span className={styles.tileLabel}>Read so far</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{stats.averageRating !== null ? stats.averageRating.toFixed(1) : '—'}</span>
          <span className={styles.tileLabel}>{stats.rated > 0 ? `Avg rating · ${pluralize(stats.rated, 'book')} rated` : 'No ratings yet'}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{genreCount}</span>
          <span className={styles.tileLabel}>{genreCount === 1 ? 'Genre' : 'Genres'} · {pluralize(languageCount, 'language')}</span>
        </div>
      </div>

      <section className="section" aria-labelledby="status-stats">
        <h2 id="status-stats" className="section-title">
          Reading status
        </h2>
        <div className={styles.card}>
          <div className={styles.stackedBar} role="img" aria-label={BOOK_STATUSES.map((s) => `${s}: ${stats.byStatus[s]}`).join(', ')}>
            {BOOK_STATUSES.map((status) => {
              const count = stats.byStatus[status]
              if (!count) return null
              return <span key={status} className={[styles.segment, statusTone[status]].join(' ')} style={{ flexGrow: count }} />
            })}
          </div>
          <ul className={styles.legend}>
            {BOOK_STATUSES.map((status) => (
              <li key={status}>
                <Link to={`/library?status=${encodeURIComponent(status)}`} className={styles.legendRow}>
                  <span className={[styles.swatch, statusTone[status]].join(' ')} aria-hidden="true" />
                  <span className={styles.legendLabel}>{status}</span>
                  <span className={styles.legendCount}>{stats.byStatus[status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {genres.length > 0 && (
        <section className="section" aria-labelledby="genre-stats">
          <h2 id="genre-stats" className="section-title">
            Genres
          </h2>
          <BarList entries={genres} max={genres[0][1]} linkKey="genre" />
        </section>
      )}

      {languages.length > 0 && (
        <section className="section" aria-labelledby="language-stats">
          <h2 id="language-stats" className="section-title">
            Languages
          </h2>
          <BarList entries={languages} max={languages[0][1]} linkKey="language" />
        </section>
      )}
    </main>
  )
}

function BarList({ entries, max, linkKey }: { entries: Array<[string, number]>; max: number; linkKey: 'genre' | 'language' }) {
  return (
    <ul className={styles.card}>
      {entries.map(([label, count]) => (
        <li key={label}>
          <Link to={`/library?${linkKey}=${encodeURIComponent(label)}`} className={styles.barRow}>
            <span className={styles.barLabel}>{label}</span>
            <span className={styles.barTrack} aria-hidden="true">
              <span className={styles.barFill} style={{ width: `${Math.max(6, Math.round((count / max) * 100))}%` }} />
            </span>
            <span className={styles.barCount}>{count}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
