import { useNavigate } from 'react-router-dom'
import { Button, Modal, BookCover, Tag } from '@/components'
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
      icon="book-check"
      title="You already have this book"
      centered
      actions={
        <>
          <Button size="lg" onClick={() => first && navigate(`/books/${first.id}`)} disabled={!first} block>
            View Existing
          </Button>
          <Button variant="secondary" size="lg" onClick={onAddAnother} loading={pending} block>
            Add Another Copy
          </Button>
        </>
      }
    >
      {duplicate && (
        <>
          <div className={styles.match}>
            <BookCover title={duplicate.title} author={duplicate.author} coverUrl={first?.coverUrl} variant="sheet" />
            <div className={styles.text}>
              <p className={styles.title}>{duplicate.title}</p>
              <p className={styles.author}>{duplicate.author}</p>
              <p className={styles.tag}>
                <Tag size="md">{pluralize(copies.length, 'copy', 'copies')} already in your library</Tag>
              </p>
            </div>
          </div>
          <p className={styles.explain}>Own more than one? Each copy is tracked separately, so you can add another without changing the first.</p>
        </>
      )}
    </Modal>
  )
}
