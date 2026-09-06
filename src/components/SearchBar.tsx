import { useId } from 'react'
import { Icon } from './Icon'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchBar({ value, onChange, placeholder = 'Search title, author or ISBN', autoFocus }: SearchBarProps) {
  const id = useId()
  return (
    <div className={styles.wrap}>
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
      />
      {value && (
        <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label="Clear search">
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  )
}
