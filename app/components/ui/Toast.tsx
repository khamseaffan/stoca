'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastData {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (opts: Omit<ToastData, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const ICONS: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-l-green-500 bg-white',
  error: 'border-l-red-500 bg-white',
  info: 'border-l-blue-500 bg-white',
}

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
}

let toastCounter = 0

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: ToastData
  onDismiss: (id: string) => void
}) {
  const [entering, setEntering] = useState(true)
  const [exiting, setExiting] = useState(false)
  const Icon = ICONS[t.variant]

  useEffect(() => {
    const enterTimer = setTimeout(() => setEntering(false), 10)
    return () => clearTimeout(enterTimer)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onDismiss(t.id), 300)
    }, 4000)
    return () => clearTimeout(timer)
  }, [t.id, onDismiss])

  const handleDismiss = () => {
    setExiting(true)
    setTimeout(() => onDismiss(t.id), 300)
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border border-secondary-200 border-l-4 px-4 py-3 shadow-lg transition-all duration-300',
        VARIANT_STYLES[t.variant],
        entering && 'translate-x-full opacity-0',
        exiting && 'translate-x-full opacity-0',
        !entering && !exiting && 'translate-x-0 opacity-100',
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_STYLES[t.variant])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-secondary-900">{t.title}</p>
        {t.description && (
          <p className="mt-0.5 text-xs text-secondary-500">{t.description}</p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-0.5 text-secondary-400 hover:text-secondary-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const toast = useCallback((opts: Omit<ToastData, 'id'>) => {
    const id = `toast-${++toastCounter}`
    setToasts((prev) => [...prev, { ...opts, id }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
