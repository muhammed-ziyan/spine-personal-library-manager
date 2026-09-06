import { useState } from 'react'
import { Button, Icon, Modal } from '@/components'
import { useAuth } from '@/hooks/useAuth'
import styles from './AccountMenu.module.css'

/** Avatar button (placed in the Home header) showing who is signed in, with sign-out. */
export function AccountMenu() {
  const { session, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  if (!session) return null
  const { user } = session

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)} aria-label={`Account: ${user.email}`} aria-haspopup="dialog">
        {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <Icon name="user" size={20} />}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={user.name || 'Your account'}
        description={user.email}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false)
              signOut()
            }}
          >
            Sign out
          </Button>
        }
      >
        <p className="muted text-sm">Your library lives in your own Google Sheet. Signing out only clears this device.</p>
      </Modal>
    </>
  )
}
