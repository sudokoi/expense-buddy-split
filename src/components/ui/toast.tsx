import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { cn } from '@/lib/utils'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

export type ToastType = 'success' | 'error' | 'info'

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, message, type }])
  }, [])

  useEffect(() => {
    if (!toasts.length) {
      return
    }

    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(1))
    }, 2400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [toasts])

  const value = useMemo(
    () => ({
      showToast,
    }),
    [showToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-4 top-4 z-50 flex max-w-[min(28rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'w-full whitespace-pre-wrap break-all rounded-[1rem] px-4 py-3 text-sm shadow-[0_18px_45px_rgba(74,68,88,0.16)] backdrop-blur-xl',
              toast.type === 'success' &&
                'border border-emerald-300/80 bg-emerald-50/95 text-emerald-950 shadow-[0_18px_45px_rgba(16,185,129,0.22)]',
              toast.type === 'error' &&
                'border border-rose-300/80 bg-rose-50/95 text-rose-950 shadow-[0_18px_45px_rgba(244,63,94,0.2)]',
              toast.type === 'info' &&
                'border border-sky-300/80 bg-sky-50/95 text-sky-950 shadow-[0_18px_45px_rgba(14,165,233,0.18)]',
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.')
  }

  return context
}
