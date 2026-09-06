import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export type ToastTone = 'neutral' | 'success' | 'danger'

export interface ToastAction {
  label: string
  to: string
}

export interface ToastMessage {
  id: number
  text: string
  tone: ToastTone
  action?: ToastAction
}

interface ToastContextValue {
  toasts: ToastMessage[]
  show: (text: string, tone?: ToastTone, action?: ToastAction) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 2800
const TOAST_WITH_ACTION_MS = 4500

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (text: string, tone: ToastTone = 'neutral', action?: ToastAction) => {
      const id = ++counter.current
      setToasts((current) => [...current.slice(-1), { id, text, tone, action }])
      window.setTimeout(() => dismiss(id), action ? TOAST_WITH_ACTION_MS : TOAST_DURATION_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss])
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
