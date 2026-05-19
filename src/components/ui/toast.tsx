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
}

interface ToastContextValue {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, message }])
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
      <div className="pointer-events-none fixed inset-x-4 bottom-5 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'max-w-sm rounded-[1rem] border border-border/80 bg-background/95 px-4 py-3 text-sm text-foreground shadow-[0_18px_45px_rgba(74,68,88,0.18)] backdrop-blur-xl',
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
