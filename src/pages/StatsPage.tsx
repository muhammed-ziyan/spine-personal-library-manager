import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components'
import { useLibrary } from '@/hooks/useLibrary'
import { describeError } from '@/services/api'
import { monthName } from '@/utils/format'
import styles from './StatsPage.module.css'

const BAR_COLORS = ['var(--color-accent)', 'var(--color-accent-2-500)', 'var(--color-accent-400)', 'var(--color-accent-2-400)', 'var(--color-neutral-500)', 'var(--color-neutral-400)']
const TOP_GENRES = 5

export function StatsPage() {
  const { books, stats, state, error, refresh } = useLibrary()
  const loading = state === 'loading' || state === 'idle'

  const genres = useMemo(() => {
    if (!stats) return []
    const sorted = Object.entries(stats.byGenre)
      .filter(([name]) => name.trim())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const top = sorted.slice(0, TOP_GENRES)
    const rest = sorted.slice(TOP_GENRES).reduce((sum, [, n]) => sum + n, 0)
    const unfiled = stats.byGenre[''] ?? 0
    if (rest + unfiled > 0) top.push(['Everything else', rest + unfiled])
    return top
  }, [stats])

  const languages = useMemo(() => {
    if (!stats) return []
    return Object.entries(stats.byLanguage)
      .filter(([name]) => name.trim())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name)
  }, [stats])

  const thisYear = useMemo(() => {
    const year = new Date().getFullYear()
    const months = new Array<number>(12).fill(0)
    let count = 0
    for (const book of books) {
      const date = new Date(book.dateAdded)
      if (date.getFullYear() !== year) continue
      count++
      months[date.getMonth()]++
    }
    const best = months.indexOf(Math.max(...months))
    return { count, bestMonth: count > 0 ? monthName(best) : null }
  }, [books])

  if (state === 'error' && error) {
    return (
      <main className={['page', 'page--nav', styles.stats].join(' ')}>
        <PageHeader display title="Your Library" />
        <ErrorState title="Couldn't load your stats" message={describeError(error)} onRetry={() => void refresh()} />
      </main>
    )
  }

  if (loading || !stats) {
    return (
      <main className={['page', 'page--nav', styles.stats].join(' ')} aria-busy="true">
        <PageHeader display title="Your Library" />
        <Skeleton width="200px" height="72px" radius="16px" />
        <div className={styles.tiles}>
          <Skeleton height="96px" radius="24px" />
          <Skeleton height="96px" radius="24px" />
          <Skeleton height="96px" radius="24px" />
        </div>
        <Skeleton height="260px" radius="28px" />
      </main>
    )
  }

  if (stats.total === 0) {
    return (
      <main className={['page', 'page--nav', styles.stats].join(' ')}>
        <PageHeader display title="Your Library" />
        <EmptyState
          icon="stats"
          title="Nothing to count yet"
          description="Your reading stats will appear here once you add a few books."
          action={
            <Button to="/scan" icon="scan" size="xl" block>
              Scan Your First Book
            </Button>
          }
        />
      </main>
    )
  }

  const maxGenre = genres.length ? Math.max(...genres.map(([, n]) => n)) : 1

  return (
    <main className={['page', 'page--nav', styles.stats].join(' ')}>
      <PageHeader display title="Your Library" />

      <div className={styles.headline}>
        <span className={styles.bigNumber}>{stats.total}</span>
        <span className={styles.bigUnit}>{stats.total === 1 ? 'Book' : 'Books'}</span>
      </div>

      <div className={styles.tiles}>
        <Link to="/library?status=Read" className={[styles.tile, styles.tileRead].join(' ')}>
          <span className={styles.tileValue}>{stats.byStatus.Read}</span>
          <span className={styles.tileLabel}>Read</span>
        </Link>
        <Link to="/library?status=Reading" className={[styles.tile, styles.tileReading].join(' ')}>
          <span className={styles.tileValue}>{stats.byStatus.Reading}</span>
          <span className={styles.tileLabel}>Reading</span>
        </Link>
        <Link to="/library?status=Unread" className={styles.tile}>
          <span className={styles.tileValue}>{stats.byStatus.Unread}</span>
          <span className={[styles.tileLabel, styles.tileLabelMuted].join(' ')}>Unread</span>
        </Link>
      </div>

      {genres.length > 0 && (
        <section className={styles.collection} aria-labelledby="collection-heading">
          <h2 id="collection-heading" className="section-title">
            Your collection
          </h2>
          {genres.map(([name, count], i) => {
            const isRest = name === 'Everything else' && i === genres.length - 1
            const row = (
              <>
                <span className={styles.barHeader}>
                  <span>{name}</span>
                  <span className={styles.barCount}>{count}</span>
                </span>
                <span className={styles.barTrack} aria-hidden="true">
                  <span className={styles.barFill} style={{ width: `${Math.max(4, Math.round((count / maxGenre) * 100))}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                </span>
              </>
            )
            return isRest ? (
              <div key={name} className={styles.bar}>
                {row}
              </div>
            ) : (
              <Link key={name} to={`/library?genre=${encodeURIComponent(name)}`} className={styles.bar}>
                {row}
              </Link>
            )
          })}
        </section>
      )}

      <div className={styles.twoUp}>
        <div className={styles.infoTile}>
          <span className={styles.infoLabel}>Languages</span>
          <span className={styles.infoValue}>{languages.length}</span>
          <span className={styles.infoText}>{languages.length ? languages.slice(0, 3).join(' · ') + (languages.length > 3 ? ` · +${languages.length - 3}` : '') : 'None recorded yet'}</span>
        </div>
        <div className={styles.infoTile}>
          <span className={styles.infoLabel}>Added this year</span>
          <span className={styles.infoValue}>{thisYear.count}</span>
          <span className={styles.infoText}>{thisYear.bestMonth ? `Most in ${thisYear.bestMonth}` : 'Nothing yet this year'}</span>
        </div>
      </div>
    </main>
  )
}
