import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Icon } from './Icon'
import styles from './FormField.module.css'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  /** `quiet`: inputs sitting on a surface card take the page colour instead. */
  tone?: 'default' | 'quiet'
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
        {optional && <span className={styles.optional}> · optional</span>}
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

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField({ label, hint, error, optional, tone = 'default', className, ...rest }, ref) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy }) => (
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={[styles.input, tone === 'quiet' && styles.quiet, className].filter(Boolean).join(' ')}
          {...rest}
        />
      )}
    </FieldShell>
  )
})

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & Omit<FieldShellProps, 'children'>

export function TextareaField({ label, hint, error, optional, tone = 'default', className, ...rest }: TextareaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={[styles.input, styles.textarea, tone === 'quiet' && styles.quiet, className].filter(Boolean).join(' ')}
          {...rest}
        />
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

export function SelectField({ label, hint, error, optional, options, placeholder, tone = 'default', className, value, ...rest }: SelectFieldProps) {
  const empty = value === '' || value === undefined
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy }) => (
        <div className={styles.selectWrap}>
          <select
            id={id}
            value={value}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={[styles.input, styles.select, empty && styles.placeholder, tone === 'quiet' && styles.quiet, className].filter(Boolean).join(' ')}
            {...rest}
          >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" size={16} className={styles.selectIcon} />
        </div>
      )}
    </FieldShell>
  )
}

interface SegmentedProps<T extends string> {
  label?: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  /** Stretch across the container (form fields) or hug content (settings rows). */
  block?: boolean
  size?: 'sm' | 'md'
}

/** Pill segmented control — the mockup's `.seg`. */
export function Segmented<T extends string>({ label, options, value, onChange, block, size = 'md' }: SegmentedProps<T>) {
  const name = useId()
  return (
    <div className={[styles.seg, block && styles.segBlock, size === 'sm' && styles.segSm].filter(Boolean).join(' ')} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className={[styles.segOpt, option.value === value && styles.segChecked].filter(Boolean).join(' ')}>
          <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} className={styles.segInput} />
          {option.label}
        </label>
      ))}
    </div>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

/** 52×32 switch with a cream knob. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={[styles.toggle, checked && styles.toggleOn].filter(Boolean).join(' ')} onClick={() => onChange(!checked)}>
      <span className={styles.knob} />
    </button>
  )
}

interface RadioRowProps {
  name: string
  label: string
  checked: boolean
  onChange: () => void
}

/** 44px radio row used inside sheets ("Sort by"). */
export function RadioRow({ name, label, checked, onChange }: RadioRowProps) {
  return (
    <label className={styles.radio}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className={styles.segInput} />
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </label>
  )
}
