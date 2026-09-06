import { useId, useState, type KeyboardEvent } from 'react'
import { Icon } from './Icon'
import { TextButton } from './Button'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  /** Called when the user presses Enter or taps a result — used to remember recent searches. */
  onCommit?: (value: string) => void
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchBar({ value, onChange, onCommit, onCancel, placeholder = 'Search your books', autoFocus }: SearchBarProps) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const active = focused || value !== ''

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      onCommit?.(value)
      event.currentTarget.blur()
    }
    if (event.key === 'Escape') {
      onChange('')
      onCancel?.()
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={[styles.bar, active && styles.active].filter(Boolean).join(' ')}>
        <label htmlFor={id} className="sr-only">
          Search your library
        </label>
        <Icon name="search" size={20} className={styles.icon} />
        <input
          id={id}
          type="search"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          className={styles.input}
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
        {value && (
          <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label="Clear search">
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
      {active && onCancel && (
        <TextButton
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange('')
            onCancel()
          }}
        >
          Cancel
        </TextButton>
      )}
    </div>
  )
}
