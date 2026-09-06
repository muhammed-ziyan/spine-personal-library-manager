import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Icon } from './Icon'
import styles from './FormField.module.css'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode
}

function FieldShell({ label, hint, error, optional, children }: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={[styles.field, error && styles.hasError].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional && <span className={styles.optional}>Optional</span>}
      </label>
      {children({ id, describedBy })}
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & Omit<FieldShellProps, 'children'>

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField({ label, hint, error, optional, className, ...rest }, ref) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy }) => (
        <input ref={ref} id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className={[styles.input, className].filter(Boolean).join(' ')} {...rest} />
      )}
    </FieldShell>
  )
})

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & Omit<FieldShellProps, 'children'>

export function TextareaField({ label, hint, error, optional, className, ...rest }: TextareaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className={[styles.input, styles.textarea, className].filter(Boolean).join(' ')} {...rest} />
      )}
    </FieldShell>
  )
}

export interface SelectOption {
  value: string
  label: string
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> &
  Omit<FieldShellProps, 'children'> & {
    options: SelectOption[]
    placeholder?: string
  }

export function SelectField({ label, hint, error, optional, options, placeholder, className, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy }) => (
        <div className={styles.selectWrap}>
          <select id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className={[styles.input, styles.select, className].filter(Boolean).join(' ')} {...rest}>
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" size={18} className={styles.selectIcon} />
        </div>
      )}
    </FieldShell>
  )
}
