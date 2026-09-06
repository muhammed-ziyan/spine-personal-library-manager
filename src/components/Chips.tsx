import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { BookStatus } from '@/types'
import { Icon, type IconName } from './Icon'
import styles from './Chips.module.css'

interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  count?: number
  /** `accent`: selected fill is terracotta (filter sheet) instead of ink (status row). */
  tone?: 'ink' | 'accent'
  size?: 'md' | 'lg'
}

/** Pill filter/choice chip: cream by default, ink (or terracotta) when selected. */
export function FilterChip({ selected = false, count, tone = 'ink', size = 'md', children, className, ...rest }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[styles.filter, size === 'lg' && styles.filterLg, selected && (tone === 'accent' ? styles.filterAccent : styles.filterSelected), className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
      {typeof count === 'number' && <span className={styles.count}>{' · '}{count}</span>}
    </button>
  )
}

interface DropdownChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  icon?: IconName
}

/** Outlined chip with a trailing chevron (Genre ▾, Language ▾) or a leading icon (sort). */
export function DropdownChip({ active, icon, children, className, ...rest }: DropdownChipProps) {
  return (
    <button type="button" className={[styles.dropdown, active && styles.dropdownActive, className].filter(Boolean).join(' ')} {...rest}>
      {icon && <Icon name={icon} size={14} />}
      <span>{children}</span>
      {!icon && <Icon name="chevron-down" size={14} />}
    </button>
  )
}

const statusClass: Record<BookStatus, string> = {
  Unread: styles.unread,
  Reading: styles.reading,
  Read: styles.read,
  'On Hold': styles.onhold,
  Abandoned: styles.abandoned,
}

interface StatusChipProps {
  status: BookStatus
  size?: 'sm' | 'md'
  /** Trailing ▾ to signal the chip opens a picker. */
  caret?: boolean
  children?: ReactNode
}

export function StatusChip({ status, size = 'sm', caret, children }: StatusChipProps) {
  return (
    <span className={[styles.status, statusClass[status], size === 'md' && styles.statusMd].filter(Boolean).join(' ')}>
      {children ?? status}
      {caret && <span aria-hidden="true"> ▾</span>}
    </span>
  )
}

/** Generic tinted pill for labels like "Connected" or "1 copy already in your library". */
export function Tag({ tone = 'read', size = 'sm', children }: { tone?: 'read' | 'reading' | 'unread'; size?: 'sm' | 'md'; children: ReactNode }) {
  const cls = tone === 'read' ? styles.read : tone === 'reading' ? styles.reading : styles.unread
  return <span className={[styles.status, cls, size === 'md' && styles.statusMd].filter(Boolean).join(' ')}>{children}</span>
}

interface ChipRowProps {
  children: ReactNode
  label: string
}

/** Horizontally scrolling chip strip with a right-edge fade. */
export function ChipRow({ children, label }: ChipRowProps) {
  return (
    <div className={styles.rowWrap}>
      <div className={styles.row} role="group" aria-label={label}>
        {children}
      </div>
    </div>
  )
}

/** Wrapping chip group (filter sheet, form status picker). */
export function ChipGroup({ children, label }: ChipRowProps) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
      {children}
    </div>
  )
}
