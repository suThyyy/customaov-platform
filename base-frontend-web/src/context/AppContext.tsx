import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Me } from '@customaov/contracts'
import { Construction, X } from 'lucide-react'
import { authAdapter } from '../api'

/* ------------------------------------------------------------------ */
/* Auth: mock (localStorage) hoặc API (/api/auth/me)                  */
/* ------------------------------------------------------------------ */

interface AuthState {
  loggedIn: boolean
  user: Me | null
  loading: boolean
  login: (user?: Me) => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

/* ------------------------------------------------------------------ */
/* Toast                                                              */
/* ------------------------------------------------------------------ */

interface ToastItem {
  id: number
  title: string
  description?: string
}

interface ToastState {
  notify: (title: string, description?: string) => void
  /** Toast chuẩn cho nút chưa có chức năng */
  comingSoon: (feature: string) => void
}

const ToastContext = createContext<ToastState | null>(null)

export function AppProviders({ children }: { children: ReactNode }) {
  const initialAuth = useRef(authAdapter.initial())
  const [loggedIn, setLoggedIn] = useState<boolean>(initialAuth.current.loggedIn)
  const [user, setUser] = useState<Me | null>(initialAuth.current.user)
  const [loading, setLoading] = useState<boolean>(!authAdapter.readyImmediately)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  // Đồng bộ đăng nhập/đăng xuất giữa các tab (mock) hoặc khôi phục phiên từ API
  useEffect(() => {
    if (!authAdapter.readyImmediately) {
      const controller = new AbortController()
      setLoading(true)
      authAdapter.restore(controller.signal).then(
        (restoredUser) => {
          setUser(restoredUser)
          setLoggedIn(restoredUser !== null)
          setLoading(false)
        },
        (err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setUser(null)
          setLoggedIn(false)
          setLoading(false)
        },
      )
      return () => controller.abort()
    }
    return authAdapter.subscribe(setLoggedIn)
  }, [])

  const auth = useMemo<AuthState>(
    () => ({
      loggedIn,
      user,
      loading,
      login: (nextUser?: Me) => {
        if (authAdapter.persistsWrites) {
          setUser(nextUser ?? null)
          setLoggedIn(Boolean(nextUser))
          setLoading(false)
          return
        }
        authAdapter.remember(true)
        setLoggedIn(true)
      },
      logout: () => {
        if (authAdapter.persistsWrites) {
          setUser(null)
          setLoggedIn(false)
          return
        }
        authAdapter.remember(false)
        setLoggedIn(false)
      },
    }),
    [loggedIn, user, loading],
  )

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const notify = useCallback(
    (title: string, description?: string) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { id, title, description }])
      window.setTimeout(() => dismiss(id), 3800)
    },
    [dismiss],
  )

  const toast = useMemo<ToastState>(
    () => ({
      notify,
      comingSoon: (feature: string) => notify('Tính năng đang phát triển', `"${feature}" sẽ có trong phiên bản tiếp theo.`),
    }),
    [notify],
  )

  return (
    <AuthContext.Provider value={auth}>
      <ToastContext.Provider value={toast}>
        {children}
        <div
          aria-live="polite"
          role="status"
          className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+12px)] z-[100] flex flex-col gap-3 md:inset-x-auto md:right-6 md:bottom-6 md:w-[360px]"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-card border border-gold/30 bg-surface-2/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-md [animation:toast-in_220ms_var(--ease-out-soft)]"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-chip bg-gold-tint text-gold">
                <Construction size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm leading-snug text-fg-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Đóng thông báo"
                className="-m-1 grid size-7 place-items-center rounded-btn text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong AppProviders')
  return ctx
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast phải nằm trong AppProviders')
  return ctx
}
