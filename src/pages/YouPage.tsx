import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Button, FilterChip, Icon, Modal, Segmented, Tag, TextButton, Toggle, type IconName } from '@/components'
import { useLibrary } from '@/hooks/useLibrary'
import { usePreferences, type ThemePreference, type ViewPreference } from '@/hooks/usePreferences'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/hooks/useToast'
import { booksToCsv, formatMonthYear, formatDate, pluralize, relativeTime } from '@/utils/format'
import styles from './YouPage.module.css'

const GOAL_PRESETS = [24, 36, 50, 75, 100]

export function YouPage() {
  const { session, signOut } = useSession()
  const { books, stats, state, lastSyncedAt, refresh } = useLibrary()
  const prefs = usePreferences()
  const toast = useToast()
  const [goalOpen, setGoalOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)

  const year = new Date().getFullYear()
  const goal = prefs.goalFor(year)
  // The Gate only renders this page with a session; the fallback keeps TypeScript honest.
  const name = session?.library ?? 'You'

  const since = useMemo(() => {
    const earliest = books.reduce<string | null>((min, b) => (min === null || b.dateAdded < min ? b.dateAdded : min), null)
    return earliest ? formatMonthYear(earliest) : null
  }, [books])

  // Books finished this year; if the sheet has no finish dates at all, fall back to everything marked Read.
  const readThisYear = useMemo(() => {
    const finished = books.filter((b) => b.dateFinished && new Date(b.dateFinished).getFullYear() === year).length
    const anyFinishDates = books.some((b) => b.dateFinished)
    return anyFinishDates ? finished : (stats?.byStatus.Read ?? 0)
  }, [books, stats, year])

  const genreCount = stats ? Object.keys(stats.byGenre).filter((g) => g.trim()).length : 0
  const languageCount = stats ? Object.keys(stats.byLanguage).filter((l) => l.trim()).length : 0

  const [draftGoal, setDraftGoal] = useState(goal ?? 50)
  const openGoal = () => {
    setDraftGoal(goal ?? 50)
    setGoalOpen(true)
  }

  const exportCsv = () => {
    if (books.length === 0) {
      toast.show('Nothing to export yet')
      return
    }
    const blob = new Blob([booksToCsv(books)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `spine-library-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.show(`Exported ${pluralize(books.length, 'book')}`, 'success')
  }

  const goalProgress = goal ? Math.min(100, Math.round((readThisYear / goal) * 100)) : 0
  const remaining = goal ? Math.max(0, goal - readThisYear) : 0
  const monthsLeft = Math.max(1, 12 - new Date().getMonth())
  const perMonth = Math.max(1, Math.ceil(remaining / monthsLeft))

  const sheetSubtitle = state === 'loading' ? 'Syncing…' : `Synced ${relativeTime(lastSyncedAt)} · ${pluralize(books.length, 'row')}`

  return (
    <main className={['page', 'page--nav', styles.you].join(' ')}>
      <header className={styles.profile}>
        <Avatar name={name} size="lg" />
        <div className={styles.profileText}>
          <h1 className={styles.name}>{name}</h1>
          <p className={styles.since}>{since ? `Collecting since ${since}` : 'Your shelves start here'}</p>
        </div>
      </header>

      <section className={styles.goal} aria-labelledby="goal-heading">
        <div className={styles.goalHeader}>
          <div>
            <div id="goal-heading" className={styles.goalLabel}>
              Reading goal · {year}
            </div>
            {goal ? (
              <div className={styles.goalNumber}>
                {readThisYear} <span className={styles.goalUnit}>of {goal} books</span>
              </div>
            ) : (
              <div className={styles.goalNumber}>
                {readThisYear} <span className={styles.goalUnit}>read this year</span>
              </div>
            )}
          </div>
          <TextButton onClick={openGoal} style={{ fontSize: 14 }}>
            {goal ? 'Edit' : 'Set goal'}
          </TextButton>
        </div>
        {goal ? (
          <>
            <div className={styles.goalTrack} role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={readThisYear} aria-label="Reading goal progress">
              <span className={styles.goalFill} style={{ width: `${goalProgress}%` }} />
            </div>
            <p className={styles.goalText}>{remaining > 0 ? `${remaining} to go — about ${perMonth} a month` : 'Goal reached — nice work.'}</p>
          </>
        ) : (
          <p className={styles.goalText}>A goal is a nudge, not a deadline.</p>
        )}
      </section>

      <section className={styles.group} aria-labelledby="library-heading">
        <h2 id="library-heading" className="section-title section-title--sm">
          Library
        </h2>
        <div className={styles.card}>
          <Row
            as="button"
            icon="upload"
            tone="reading"
            title={session?.library || 'Google Sheet'}
            subtitle={sheetSubtitle}
            trailing={<Tag>{state === 'error' ? 'Retry' : 'Connected'}</Tag>}
            onClick={() => void refresh()}
          />
          <Row as="link" to="/stats" icon="library" tone="read" title="Genres & languages" subtitle={`${pluralize(genreCount, 'genre')} · ${pluralize(languageCount, 'language')}`} />
          <Row as="button" icon="download" tone="unread" title="Export library" subtitle="CSV for any spreadsheet" onClick={exportCsv} />
        </div>
      </section>

      <section className={styles.group} aria-labelledby="prefs-heading">
        <h2 id="prefs-heading" className="section-title section-title--sm">
          Preferences
        </h2>
        <div className={styles.card}>
          <Row
            title="Appearance"
            subtitle="Light, dark or match system"
            trailing={
              <Segmented<ThemePreference>
                label="Appearance"
                size="sm"
                value={prefs.theme}
                onChange={prefs.setTheme}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'auto', label: 'Auto' },
                ]}
              />
            }
          />
          <Row
            title="Default view"
            subtitle="How the library opens"
            trailing={
              <Segmented<ViewPreference>
                label="Default view"
                size="sm"
                value={prefs.defaultView}
                onChange={prefs.setDefaultView}
                options={[
                  { value: 'list', label: 'List' },
                  { value: 'grid', label: 'Grid' },
                ]}
              />
            }
          />
          <Row title="Haptics on scan" subtitle="A tap when a barcode is read" trailing={<Toggle checked={prefs.haptics} onChange={prefs.setHaptics} label="Haptics on scan" />} />
        </div>
      </section>

      <section className={styles.group} aria-labelledby="account-heading">
        <h2 id="account-heading" className="section-title section-title--sm">
          Account
        </h2>
        <div className={styles.card}>
          <Row icon="user" tone="read" title={session?.username ?? 'Signed in'} subtitle={session ? `Signed in until ${formatDate(new Date(session.expiresAt).toISOString())}` : undefined} trailing={<Tag tone="reading">Signed in</Tag>} />
          <Row as="button" icon="logout" tone="unread" title="Sign out" subtitle="You'll need your password to get back in" onClick={() => setSignOutOpen(true)} />
        </div>
      </section>

      <p className={styles.footer}>Spine 1.0 · Your library lives in your own Google Sheet.</p>

      <Modal
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="Books this year"
        description={`You've read ${readThisYear} so far. A goal is a nudge, not a deadline.`}
        centered
        actions={
          <>
            <Button
              size="lg"
              block
              onClick={() => {
                prefs.setGoal(year, draftGoal)
                setGoalOpen(false)
              }}
            >
              Save Goal
            </Button>
            {goal && (
              <Button
                variant="ghost"
                block
                className={styles.removeGoal}
                onClick={() => {
                  prefs.setGoal(year, null)
                  setGoalOpen(false)
                }}
              >
                Remove goal
              </Button>
            )}
          </>
        }
      >
        <div className={styles.stepper}>
          <button type="button" className={styles.stepButton} onClick={() => setDraftGoal((g) => Math.max(1, g - 1))} aria-label="Fewer books">
            <Icon name="minus" size={24} />
          </button>
          <span className={styles.stepValue} aria-live="polite">
            {draftGoal}
          </span>
          <button type="button" className={[styles.stepButton, styles.stepButtonAccent].join(' ')} onClick={() => setDraftGoal((g) => Math.min(999, g + 1))} aria-label="More books">
            <Icon name="plus" size={24} />
          </button>
        </div>
        <div className={styles.presets}>
          {GOAL_PRESETS.map((preset) => (
            <FilterChip key={preset} selected={draftGoal === preset} onClick={() => setDraftGoal(preset)}>
              {preset}
            </FilterChip>
          ))}
        </div>
      </Modal>

      <Modal
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        variant="dialog"
        icon="logout"
        title="Sign out of Spine?"
        description="Your books stay safe in the Google Sheet. This only ends the session on this device."
        actions={
          <>
            <Button
              variant="danger"
              block
              onClick={() => {
                setSignOutOpen(false)
                signOut()
              }}
            >
              Sign out
            </Button>
            <Button variant="secondary" block onClick={() => setSignOutOpen(false)}>
              Stay signed in
            </Button>
          </>
        }
      />
    </main>
  )
}

interface RowProps {
  as?: 'div' | 'button' | 'link'
  to?: string
  icon?: IconName
  tone?: 'reading' | 'read' | 'unread'
  title: string
  subtitle?: string
  trailing?: ReactNode
  onClick?: () => void
}

function Row({ as = 'div', to = '/', icon, tone = 'unread', title, subtitle, trailing, onClick }: RowProps) {
  const content = (
    <>
      {icon && (
        <span className={[styles.rowIcon, styles[`tone-${tone}`]].join(' ')}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {subtitle && <span className={styles.rowSubtitle}>{subtitle}</span>}
      </span>
      {trailing ?? (as !== 'div' ? <Icon name="chevron-right" size={18} className={styles.rowChevron} /> : null)}
    </>
  )
  if (as === 'link') {
    return (
      <Link to={to} className={styles.row}>
        {content}
      </Link>
    )
  }
  if (as === 'button') {
    return (
      <button type="button" className={styles.row} onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className={styles.row}>{content}</div>
}
