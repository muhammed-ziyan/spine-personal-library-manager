import { useToast } from '@/hooks/useToast'
import { Icon } from './Icon'
import styles from './Toast.module.css'

export function ToastViewport() {
  const { toasts, dismiss } = useToast()
  return (
    <div className={styles.viewport} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={[styles.toast, styles[toast.tone]].join(' ')} role="status">
          {toast.tone === 'success' && <Icon name="check" size={18} />}
          {toast.tone === 'danger' && <Icon name="alert" size={18} />}
          <span className={styles.text}>{toast.text}</span>
          <button type="button" className={styles.close} onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
