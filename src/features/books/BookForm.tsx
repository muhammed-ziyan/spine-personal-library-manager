import { useState, type FormEvent } from 'react'
import { Button, ChipGroup, FilterChip, Icon, IconButton, InputField, Rating, Segmented, SelectField, TextButton, TextareaField } from '@/components'
import { BOOK_FORMATS, BOOK_STATUSES, type BookInput, type Genre } from '@/types'
import { LIMITS, hasErrors, validateBookInput, type FieldErrors } from '@/utils/validation'
import { formatIsbn } from '@/utils/isbn'
import styles from './BookForm.module.css'

export type BookFormMode = 'scanned' | 'manual' | 'copy' | 'edit'

interface BookFormProps {
  mode: BookFormMode
  initial: BookInput
  genres: Genre[]
  submitLabel: string
  pending?: boolean
  onSubmit: (input: BookInput) => void
  /** Scanned / copy flows: swap the ISBN for another one. */
  onChangeIsbn?: () => void
  /** Manual flow: open the scanner from the ISBN field. */
  onScan?: () => void
  /** Edit flow: "Delete this book" beneath the form. */
  onDelete?: () => void
  /** Open the "More details" section by default (edit mode). */
  expanded?: boolean
}

const COMMON_LANGUAGES = ['English', 'Malayalam', 'Hindi', 'Tamil', 'Arabic', 'French', 'German', 'Spanish']
const SEG_FORMATS = ['Paperback', 'Hardcover'] as const
type FormatSegment = 'Paperback' | 'Hardcover' | 'other' | ''
const OTHER_FORMATS = BOOK_FORMATS.filter((f) => !(SEG_FORMATS as readonly string[]).includes(f))

function formatSegment(format: string): FormatSegment {
  if (format === 'Paperback' || format === 'Hardcover') return format
  return format ? 'other' : ''
}

function summarize(values: BookInput): string {
  const parts = [values.publisher, values.publicationYear ? String(values.publicationYear) : '', values.edition, values.pages ? `${values.pages} pages` : '', values.format].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Publisher, year, edition, pages, format, notes'
}

export function BookForm({ mode, initial, genres, submitLabel, pending, onSubmit, onChangeIsbn, onScan, onDelete, expanded = false }: BookFormProps) {
  const [values, setValues] = useState<BookInput>(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [showMore, setShowMore] = useState(expanded || mode === 'manual' || Boolean(initial.publisher || initial.notes || initial.pages))
  const [customLanguage, setCustomLanguage] = useState(() => Boolean(initial.language) && !COMMON_LANGUAGES.includes(initial.language))

  const lockedIsbn = (mode === 'scanned' || mode === 'copy') && Boolean(initial.isbn)

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
      if (nextErrors.isbn || nextErrors.publisher || nextErrors.notes || nextErrors.pages || nextErrors.publicationYear || nextErrors.coverUrl) setShowMore(true)
      window.setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
      return
    }
    onSubmit(cleaned)
  }

  const segment = formatSegment(values.format)

  const isbnField = (
    <div className={styles.isbnField}>
      <div className={styles.isbnInput}>
        <InputField
          label="ISBN"
          optional
          value={values.isbn}
          onChange={(e) => update('isbn', e.target.value)}
          error={errors.isbn}
          inputMode="numeric"
          autoComplete="off"
          placeholder="If the book has one"
        />
      </div>
      {onScan && <IconButton icon="scan" label="Scan barcode" tone="large" onClick={onScan} className={styles.scanButton} />}
    </div>
  )

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {lockedIsbn && (
        <div className={styles.isbnBanner}>
          <Icon name="scan" size={20} />
          <span className={styles.isbnValue}>ISBN {formatIsbn(values.isbn)}</span>
          {onChangeIsbn && (
            <button type="button" className={styles.isbnChange} onClick={onChangeIsbn}>
              Change
            </button>
          )}
        </div>
      )}

      <div className={styles.fields}>
        <InputField label="Title" value={values.title} onChange={(e) => update('title', e.target.value)} error={errors.title} maxLength={LIMITS.title} autoComplete="off" autoFocus={!initial.title} placeholder="What's it called?" required />
        <InputField label="Author" value={values.author} onChange={(e) => update('author', e.target.value)} error={errors.author} maxLength={LIMITS.author} autoComplete="off" placeholder="Who wrote it?" required />

        <div className={styles.twoUp}>
          <SelectField label="Genre" value={values.genre} onChange={(e) => update('genre', e.target.value)} options={genreOptions} placeholder="Choose" error={errors.genre} />
          {customLanguage ? (
            <InputField label="Language" value={values.language} onChange={(e) => update('language', e.target.value)} error={errors.language} maxLength={LIMITS.language} autoComplete="off" placeholder="Type it" autoFocus />
          ) : (
            <SelectField
              label="Language"
              value={values.language}
              onChange={(e) => {
                if (e.target.value === '__other') {
                  setCustomLanguage(true)
                  update('language', '')
                } else update('language', e.target.value)
              }}
              options={[...COMMON_LANGUAGES.map((l) => ({ value: l, label: l })), { value: '__other', label: 'Other…' }]}
              placeholder="Choose"
              error={errors.language}
            />
          )}
        </div>

        <div>
          <span className="field-label">Status</span>
          <ChipGroup label="Status">
            {BOOK_STATUSES.map((status) => (
              <FilterChip key={status} size="lg" selected={values.status === status} onClick={() => update('status', status)}>
                {status}
              </FilterChip>
            ))}
          </ChipGroup>
          {errors.status && (
            <p className={styles.error} role="alert">
              {errors.status}
            </p>
          )}
        </div>

        <div>
          <span className="field-label">Rating</span>
          <Rating value={values.rating} onChange={(rating) => update('rating', rating)} size="lg" caption />
          {errors.rating && (
            <p className={styles.error} role="alert">
              {errors.rating}
            </p>
          )}
        </div>

        {mode === 'manual' && isbnField}
      </div>

      <section className={styles.more}>
        <button type="button" className={styles.moreToggle} onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
          <span className={styles.moreText}>
            <span className={styles.moreTitle}>More details</span>
            {!showMore && <span className={styles.moreHint}>{summarize(values)}</span>}
          </span>
          <Icon name={showMore ? 'chevron-up' : 'chevron-down'} size={18} />
        </button>

        {showMore && (
          <div className={styles.moreBody}>
            <div className={styles.twoUp}>
              <InputField tone="quiet" label="Publisher" value={values.publisher} onChange={(e) => update('publisher', e.target.value)} error={errors.publisher} maxLength={LIMITS.publisher} autoComplete="off" />
              <InputField tone="quiet" label="Year" value={values.publicationYear ?? ''} onChange={(e) => update('publicationYear', numberOrNull(e.target.value))} error={errors.publicationYear} inputMode="numeric" placeholder="2019" />
              <InputField tone="quiet" label="Edition" value={values.edition} onChange={(e) => update('edition', e.target.value)} error={errors.edition} maxLength={LIMITS.edition} placeholder="1st" />
              <InputField tone="quiet" label="Pages" value={values.pages ?? ''} onChange={(e) => update('pages', numberOrNull(e.target.value))} error={errors.pages} inputMode="numeric" placeholder="0" />
            </div>

            <div>
              <span className="field-label">Format</span>
              <Segmented<FormatSegment>
                label="Format"
                block
                value={segment}
                options={[
                  { value: 'Paperback', label: 'Paperback' },
                  { value: 'Hardcover', label: 'Hardcover' },
                  { value: 'other', label: 'Other' },
                ]}
                onChange={(next) => update('format', next === 'other' ? 'Other' : next)}
              />
              {segment === 'other' && (
                <div className={styles.otherFormat}>
                  <SelectField tone="quiet" label="Which format?" value={values.format} onChange={(e) => update('format', e.target.value)} options={OTHER_FORMATS.map((f) => ({ value: f, label: f }))} error={errors.format} />
                </div>
              )}
            </div>

            {mode === 'edit' && (
              <InputField
                tone="quiet"
                label="ISBN"
                optional
                value={values.isbn}
                onChange={(e) => update('isbn', e.target.value)}
                error={errors.isbn}
                inputMode="numeric"
                autoComplete="off"
                placeholder="978…"
              />
            )}

            <TextareaField tone="quiet" label="Notes" value={values.notes} onChange={(e) => update('notes', e.target.value)} error={errors.notes} maxLength={LIMITS.notes} placeholder="Where it came from, who to lend it to…" />
            <InputField tone="quiet" label="Cover image link" optional value={values.coverUrl} onChange={(e) => update('coverUrl', e.target.value)} error={errors.coverUrl} inputMode="url" placeholder="https://…" />
          </div>
        )}
      </section>

      {onDelete && (
        <div className={styles.deleteRow}>
          <TextButton tone="danger" onClick={onDelete} style={{ fontSize: 15 }}>
            Delete this book
          </TextButton>
        </div>
      )}

      <div className="page-footer">
        <Button type="submit" size="lg" block loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
