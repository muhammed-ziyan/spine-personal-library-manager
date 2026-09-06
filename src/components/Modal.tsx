import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './Modal.module.css'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: ReactNode
  /** Footer actions, stacked. */
  actions?: ReactNode
  /** Bottom sheet (default) or centred dialog. */
  variant?: 'sheet' | 'dialog'
  /** Circular icon above a dialog's title (trash, book-check…). */
  icon?: IconName
  /** Text action at the right of a sheet's title ("Reset"). */
  titleAction?: ReactNode
  /** Centre the sheet's title (duplicate warning, edit goal). */
  centered?: boolean
}

/**
 * Accessible modal built on the native <dialog> element: focus trapping,
 * Escape-to-close and an inert background come for free.
 */
export function Modal({ open, onClose, title, description, children, actions, variant = 'sheet', icon, titleAction, centered }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handleCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  const isDialog = variant === 'dialog'

  return (
    <dialog
      ref={ref}
      className={[styles.root, isDialog ? styles.centered : styles.sheet].join(' ')}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={[styles.panel, isDialog && styles.dialogPanel, centered && styles.centeredText].filter(Boolean).join(' ')}>
        {!isDialog && <span className={styles.grabber} aria-hidden="true" />}
        {icon && (
          <span className={styles.icon}>
            <Icon name={icon} size={isDialog ? 26 : 30} />
          </span>
        )}
        {(title || titleAction) && (
          <header className={styles.header}>
            {title && (
              <h2 id={titleId} className={isDialog ? styles.dialogTitle : styles.title}>
                {title}
              </h2>
            )}
            {titleAction}
          </header>
        )}
        {description && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        {children}
        {actions && <footer className={styles.actions}>{actions}</footer>}
      </div>
    </dialog>
  )
}

interface OptionListProps<T extends string> {
  options: Array<{ value: T; label: string; hint?: string }>
  value: T | null
  onSelect: (value: T) => void
}

/** Simple single-select list used inside sheets (status, actions…). */
export function OptionList<T extends string>({ options, value, onSelect }: OptionListProps<T>) {
  return (
    <ul className={styles.optionList} role="listbox">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <li key={option.value}>
            <button type="button" role="option" aria-selected={selected} className={[styles.option, selected && styles.optionSelected].filter(Boolean).join(' ')} onClick={() => onSelect(option.value)}>
              <span className={[styles.dot, selected && styles.dotOn].filter(Boolean).join(' ')} aria-hidden="true" />
              <span className={styles.optionLabel}>{option.label}</span>
              {option.hint && <span className={styles.optionHint}>{option.hint}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Section inside a sheet: small bold label above chips or rows. */
export function SheetSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </div>
  )
}
