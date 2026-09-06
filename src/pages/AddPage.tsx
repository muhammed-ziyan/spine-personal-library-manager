import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Icon, InputField, Modal, PageHeader } from '@/components'
import { parseIsbn } from '@/utils/isbn'
import styles from './AddPage.module.css'

export function AddPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // `/add?enter=isbn` (from the scanner's fallback) opens the ISBN entry straight away.
  const [isbnOpen, setIsbnOpen] = useState(() => params.get('enter') === 'isbn')
  const [isbn, setIsbn] = useState('')
  const [isbnError, setIsbnError] = useState<string | undefined>()

  function submitIsbn(event: FormEvent) {
    event.preventDefault()
    const parsed = parseIsbn(isbn)
    if (!parsed.valid) {
      setIsbnError(parsed.kind === 'empty' ? 'Enter an ISBN, or add the book without one.' : 'That does not look like a valid ISBN-10 or ISBN-13.')
      return
    }
    setIsbnOpen(false)
    navigate(`/books/new?isbn=${parsed.isbn}`)
  }

  return (
    <main className="page">
      <PageHeader title="Add a book" display />

      <div className={styles.options}>
        <Link to="/scan" className={[styles.option, styles.primary].join(' ')}>
          <span className={styles.iconWrap}>
            <Icon name="scan" size={28} />
          </span>
          <span className={styles.text}>
            <span className={styles.title}>Scan barcode</span>
            <span className={styles.description}>Point your camera at the ISBN barcode on the back cover.</span>
          </span>
          <Icon name="chevron-right" size={20} className={styles.chevron} />
        </Link>

        <button type="button" className={styles.option} onClick={() => setIsbnOpen(true)}>
          <span className={styles.iconWrap}>
            <Icon name="keyboard" size={26} />
          </span>
          <span className={styles.text}>
            <span className={styles.title}>Enter ISBN</span>
            <span className={styles.description}>Type the number printed near the barcode.</span>
          </span>
          <Icon name="chevron-right" size={20} className={styles.chevron} />
        </button>

        <Link to="/books/new" className={styles.option}>
          <span className={styles.iconWrap}>
            <Icon name="pencil" size={26} />
          </span>
          <span className={styles.text}>
            <span className={styles.title}>Add manually</span>
            <span className={styles.description}>For books without a barcode, or when you'd rather type.</span>
          </span>
          <Icon name="chevron-right" size={20} className={styles.chevron} />
        </Link>
      </div>

      <Modal open={isbnOpen} onClose={() => setIsbnOpen(false)} title="Enter ISBN" description="ISBN-10 or ISBN-13, with or without dashes.">
        <form onSubmit={submitIsbn} className={styles.isbnForm} noValidate>
          <InputField
            label="ISBN"
            value={isbn}
            onChange={(e) => {
              setIsbn(e.target.value)
              setIsbnError(undefined)
            }}
            error={isbnError}
            inputMode="numeric"
            autoComplete="off"
            placeholder="978-0-7352-1129-2"
            autoFocus
          />
          <Button type="submit" size="lg" block>
            Continue
          </Button>
          <Button to="/books/new" variant="ghost" block onClick={() => setIsbnOpen(false)}>
            Add without ISBN
          </Button>
        </form>
      </Modal>
    </main>
  )
}
