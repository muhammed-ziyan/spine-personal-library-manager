import { Link } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { Icon } from './Icon'
import styles from './Toast.module.css'

export function ToastViewport() {
  const { toasts, dismiss } = useToast()
  return (
    <div className={styles.viewport} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast} role="status">
          {toast.tone !== 'neutral' && (
            <span className={[styles.badge, toast.tone === 'danger' && styles.badgeDanger].filter(Boolean).join(' ')}>
              <Icon name={toast.tone === 'success' ? 'check' : 'alert'} size={16} strokeWidth={3} />
            </span>
          )}
          <span className={styles.text}>{toast.text}</span>
          {toast.action ? (
            <Link to={toast.action.to} className={styles.action} onClick={() => dismiss(toast.id)}>
              {toast.action.label}
            </Link>
          ) : (
            <button type="button" className={styles.close} onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
