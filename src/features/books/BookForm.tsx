import { useState, type FormEvent } from 'react'
import { Button, Icon, InputField, Rating, SelectField, TextareaField } from '@/components'
import { BOOK_FORMATS, BOOK_STATUSES, type BookInput, type Genre } from '@/types'
import { LIMITS, hasErrors, validateBookInput, type FieldErrors } from '@/utils/validation'
import { formatIsbn } from '@/utils/isbn'
import styles from './BookForm.module.css'

interface BookFormProps {
  initial: BookInput
  genres: Genre[]
  submitLabel: string
  pending?: boolean
  onSubmit: (input: BookInput) => void
  /** Show the ISBN as a read-only banner (scanned) rather than an input. */
  lockedIsbn?: boolean
  /** Open the "More details" section by default (edit mode). */
  expanded?: boolean
}

const COMMON_LANGUAGES = ['English', 'Malayalam', 'Hindi', 'Tamil', 'Arabic', 'French', 'German', 'Spanish', 'Other']

export function BookForm({ initial, genres, submitLabel, pending, onSubmit, lockedIsbn, expanded = false }: BookFormProps) {
  const [values, setValues] = useState<BookInput>(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [showMore, setShowMore] = useState(expanded || Boolean(initial.publisher || initial.notes || initial.pages))
  const [customLanguage, setCustomLanguage] = useState(() => Boolean(initial.language) && !COMMON_LANGUAGES.includes(initial.language))

  const genreOptions = genres.map((g) => ({ value: g.name, label: g.name }))
  if (values.genre && !genres.some((g) => g.name === values.genre)) {
    genreOptions.unshift({ value: values.genre, label: values.genre })
  }

  function update<K extends keyof BookInput>(key: K, value: BookInput[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function numberOrNull(raw: string): number | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cleaned: BookInput = {
      ...values,
      title: values.title.trim(),
      author: values.author.trim(),
      publisher: values.publisher.trim(),
      edition: values.edition.trim(),
      notes: values.notes.trim(),
      coverUrl: values.coverUrl.trim(),
      language: values.language.trim(),
    }
    const nextErrors = validateBookInput(cleaned)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) {
      if (nextErrors.isbn || nextErrors.publisher || nextErrors.notes || nextErrors.pages || nextErrors.publicationYear) setShowMore(true)
      const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]')
      firstInvalid?.focus()
      return
    }
    onSubmit(cleaned)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {lockedIsbn && values.isbn && (
        <div className={styles.isbnBanner}>
          <Icon name="scan" size={20} />
          <div>
            <p className={styles.isbnLabel}>Scanned ISBN</p>
            <p className={styles.isbnValue}>{formatIsbn(values.isbn)}</p>
          </div>
        </div>
      )}

      <div className={styles.group}>
        <InputField label="Title" value={values.title} onChange={(e) => update('title', e.target.value)} error={errors.title} maxLength={LIMITS.title} autoComplete="off" autoFocus={!initial.title} required />
        <InputField label="Author" value={values.author} onChange={(e) => update('author', e.target.value)} error={errors.author} maxLength={LIMITS.author} autoComplete="off" required />
        <SelectField label="Genre" optional value={values.genre} onChange={(e) => update('genre', e.target.value)} options={genreOptions} placeholder="Choose a genre" error={errors.genre} />

        {customLanguage ? (
          <InputField
            label="Language"
            optional
            value={values.language}
            onChange={(e) => update('language', e.target.value)}
            error={errors.language}
            maxLength={LIMITS.language}
            hint="Type the language name."
            autoComplete="off"
          />
        ) : (
          <SelectField
            label="Language"
            optional
            value={values.language}
            onChange={(e) => {
              if (e.target.value === '__other') {
                setCustomLanguage(true)
                update('language', '')
              } else update('language', e.target.value)
            }}
            options={[...COMMON_LANGUAGES.filter((l) => l !== 'Other').map((l) => ({ value: l, label: l })), { value: '__other', label: 'Other…' }]}
            placeholder="Choose a language"
            error={errors.language}
          />
        )}

        <SelectField label="Status" value={values.status} onChange={(e) => update('status', e.target.value as BookInput['status'])} options={BOOK_STATUSES.map((s) => ({ value: s, label: s }))} error={errors.status} />

        <div className={styles.ratingField}>
          <span className={styles.ratingLabel}>
            Rating <span className={styles.optional}>Optional</span>
          </span>
          <Rating value={values.rating} onChange={(rating) => update('rating', rating)} size="md" />
          {errors.rating && (
            <p className={styles.error} role="alert">
              {errors.rating}
            </p>
          )}
        </div>
      </div>

      <button type="button" className={styles.moreToggle} onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
        <span>More details</span>
        <Icon name="chevron-down" size={18} className={showMore ? styles.chevronOpen : undefined} />
      </button>

      {showMore && (
        <div className={styles.group}>
          {!lockedIsbn && (
            <InputField
              label="ISBN"
              optional
              value={values.isbn}
              onChange={(e) => update('isbn', e.target.value)}
              error={errors.isbn}
              inputMode="numeric"
              autoComplete="off"
              placeholder="978…"
              hint="Leave empty for books without a barcode."
            />
          )}
          <InputField label="Publisher" optional value={values.publisher} onChange={(e) => update('publisher', e.target.value)} error={errors.publisher} maxLength={LIMITS.publisher} autoComplete="off" />
          <div className={styles.twoUp}>
            <InputField label="Publication year" optional value={values.publicationYear ?? ''} onChange={(e) => update('publicationYear', numberOrNull(e.target.value))} error={errors.publicationYear} inputMode="numeric" placeholder="2019" />
            <InputField label="Pages" optional value={values.pages ?? ''} onChange={(e) => update('pages', numberOrNull(e.target.value))} error={errors.pages} inputMode="numeric" placeholder="320" />
          </div>
          <div className={styles.twoUp}>
            <InputField label="Edition" optional value={values.edition} onChange={(e) => update('edition', e.target.value)} error={errors.edition} maxLength={LIMITS.edition} placeholder="1st" />
            <SelectField label="Format" optional value={values.format} onChange={(e) => update('format', e.target.value)} options={BOOK_FORMATS.map((f) => ({ value: f, label: f }))} placeholder="Choose" error={errors.format} />
          </div>
          <TextareaField label="Notes" optional value={values.notes} onChange={(e) => update('notes', e.target.value)} error={errors.notes} maxLength={LIMITS.notes} placeholder="Where you bought it, who lent it to you, thoughts…" />
          <InputField label="Cover image link" optional value={values.coverUrl} onChange={(e) => update('coverUrl', e.target.value)} error={errors.coverUrl} inputMode="url" placeholder="https://…" hint="Optional https:// link to a cover image." />
        </div>
      )}

      <div className={styles.submit}>
        <Button type="submit" size="lg" block loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
