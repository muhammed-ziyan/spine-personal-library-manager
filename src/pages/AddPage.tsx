import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Icon, InputField, Modal, PageHeader, type IconName } from '@/components'
import { parseIsbn } from '@/utils/isbn'
import styles from './AddPage.module.css'

const OPTIONS: Array<{ to?: string; action?: 'isbn'; icon: IconName; title: string; text: string; primary?: boolean }> = [
  { to: '/scan', icon: 'scan', title: 'Scan barcode', text: 'Point your camera at the ISBN on the back cover.', primary: true },
  { action: 'isbn', icon: 'keyboard', title: 'Enter ISBN', text: 'Type the number printed near the barcode.' },
  { to: '/books/new', icon: 'pencil', title: 'Add manually', text: 'For books without a barcode, or when you’d rather type.' },
]

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
    <main className={['page', 'page--nav', styles.add].join(' ')}>
      <PageHeader display title="Add a book" />

      <div className={styles.options}>
        {OPTIONS.map((option) => {
          const inner = (
            <>
              <span className={styles.iconWrap}>
                <Icon name={option.icon} size={24} />
              </span>
              <span className={styles.text}>
                <span className={styles.title}>{option.title}</span>
                <span className={styles.description}>{option.text}</span>
              </span>
              <Icon name="chevron-right" size={18} className={styles.chevron} />
            </>
          )
          const className = [styles.option, option.primary && styles.primary].filter(Boolean).join(' ')
          return option.to ? (
            <Link key={option.title} to={option.to} className={className}>
              {inner}
            </Link>
          ) : (
            <button key={option.title} type="button" className={className} onClick={() => setIsbnOpen(true)}>
              {inner}
            </button>
          )
        })}
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
