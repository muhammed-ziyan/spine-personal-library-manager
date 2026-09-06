import type { ButtonHTMLAttributes } from 'react'
import type { BookStatus } from '@/types'
import { Icon } from './Icon'
import styles from './Chips.module.css'

interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  count?: number
}

export function FilterChip({ selected = false, count, children, className, ...rest }: FilterChipProps) {
  return (
    <button type="button" aria-pressed={selected} className={[styles.filter, selected && styles.filterSelected, className].filter(Boolean).join(' ')} {...rest}>
      <span>{children}</span>
      {typeof count === 'number' && <span className={styles.count}>{count}</span>}
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
  showDot?: boolean
}

export function StatusChip({ status, size = 'sm', showDot = true }: StatusChipProps) {
  return (
    <span className={[styles.status, statusClass[status], size === 'md' && styles.statusMd].filter(Boolean).join(' ')}>
      {showDot && <span className={styles.dot} aria-hidden="true" />}
      {status}
    </span>
  )
}

interface ChipRowProps {
  children: React.ReactNode
  label: string
}

/** Horizontally scrolling chip strip with edge fade. */
export function ChipRow({ children, label }: ChipRowProps) {
  return (
    <div className={styles.rowWrap}>
      <div className={styles.row} role="group" aria-label={label}>
        {children}
      </div>
    </div>
  )
}

interface DropdownChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function DropdownChip({ active, children, className, ...rest }: DropdownChipProps) {
  return (
    <button type="button" className={[styles.filter, active && styles.filterSelected, styles.dropdown, className].filter(Boolean).join(' ')} {...rest}>
      <span>{children}</span>
      <Icon name="chevron-down" size={16} />
    </button>
  )
}
