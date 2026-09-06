import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'
import styles from './Modal.module.css'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  /** Footer actions. */
  actions?: ReactNode
  /** Bottom sheet on mobile (default) or centred dialog. */
  variant?: 'sheet' | 'dialog'
  hideClose?: boolean
}

/**
 * Accessible modal built on the native <dialog> element: focus trapping,
 * Escape-to-close and an inert background come for free.
 */
export function Modal({ open, onClose, title, description, children, actions, variant = 'sheet', hideClose }: ModalProps) {
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

  return (
    <dialog
      ref={ref}
      className={[styles.root, variant === 'sheet' ? styles.sheet : styles.centered].join(' ')}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.panel}>
        {variant === 'sheet' && <span className={styles.grabber} aria-hidden="true" />}
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            )}
          </div>
          {!hideClose && <IconButton icon="close" label="Close" onClick={onClose} />}
        </header>
        {children && <div className={styles.body}>{children}</div>}
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

/** Simple single-select list used inside sheets (status, sort, genre…). */
export function OptionList<T extends string>({ options, value, onSelect }: OptionListProps<T>) {
  return (
    <ul className={styles.optionList} role="listbox">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <li key={option.value}>
            <button type="button" role="option" aria-selected={selected} className={[styles.option, selected && styles.optionSelected].filter(Boolean).join(' ')} onClick={() => onSelect(option.value)}>
              <span className={styles.optionLabel}>{option.label}</span>
              {option.hint && <span className={styles.optionHint}>{option.hint}</span>}
              {selected && <span className={styles.optionCheck} aria-hidden="true" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
