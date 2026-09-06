import { useNavigate } from 'react-router-dom'
import { Button, Modal, BookCover } from '@/components'
import type { DuplicateMatch } from '@/types'
import { pluralize } from '@/utils/format'
import styles from './DuplicateSheet.module.css'

interface DuplicateSheetProps {
  duplicate: DuplicateMatch | null
  onClose: () => void
  onAddAnother: () => void
  pending?: boolean
}

/** "You already have this book" — never blocks; lets the user add another physical copy. */
export function DuplicateSheet({ duplicate, onClose, onAddAnother, pending }: DuplicateSheetProps) {
  const navigate = useNavigate()
  const open = Boolean(duplicate)
  const copies = duplicate?.copies ?? []
  const first = copies[0]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="You already have this book"
      variant="sheet"
      actions={
        <>
          <Button variant="primary" onClick={onAddAnother} loading={pending}>
            Add Another Copy
          </Button>
          <Button variant="secondary" onClick={() => first && navigate(`/books/${first.id}`)} disabled={!first}>
            View Existing
          </Button>
        </>
      }
    >
      {duplicate && (
        <div className={styles.match}>
          <BookCover title={duplicate.title} author={duplicate.author} coverUrl={first?.coverUrl} size="md" />
          <div className={styles.text}>
            <p className={styles.title}>{duplicate.title}</p>
            <p className={styles.author}>{duplicate.author}</p>
            <p className={styles.copies}>
              {pluralize(copies.length, 'copy', 'copies')} already in your library
              {copies.length > 0 && (
                <span className={styles.formats}>
                  {' '}
                  · {copies.map((copy) => copy.format || 'Unspecified format').join(', ')}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}
