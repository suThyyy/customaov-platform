import { startTransition, useEffect, useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoginBodySchema, RegisterBodySchema } from '@customaov/contracts'
import { LogIn, UserPlus } from 'lucide-react'
import { cn } from '../lib/cn'
import { useAuth, useToast } from '../context/AppContext'
import { ApiError, authAdapter, currentUser } from '../api'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import { Tabs } from './ui/Tabs'
import { Avatar, LevelPill } from './ui/primitives'

export type LoginIntent = 'login' | 'register' | 'start'
type AuthTab = 'login' | 'register'
type FieldName = 'username' | 'displayName' | 'password'
type FieldErrors = Partial<Record<FieldName, string>>

const TITLES: Record<LoginIntent, string> = {
  login: 'Đăng nhập',
  register: 'Đăng ký tài khoản',
  start: 'Bắt đầu với customAOV',
}

const FIELD_MESSAGES: Record<FieldName, string> = {
  username: 'Tên đăng nhập dài 3–20 ký tự, chỉ gồm chữ thường, số và dấu gạch dưới (_).',
  displayName: 'Tên hiển thị dài 1–24 ký tự.',
  password: 'Mật khẩu dài 8–72 ký tự.',
}

function formatServerError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return err.message || 'Tên đăng nhập hoặc mật khẩu không đúng.'
    if (err.status === 409) return err.message || 'Tên đăng nhập đã được sử dụng.'
    if (err.status === 429) {
      if (/\d+\s*giây/i.test(err.message)) return err.message
      if (err.retryAfter) return `Bạn thao tác quá nhanh, thử lại sau ${err.retryAfter} giây.`
      return err.message || 'Bạn thao tác quá nhanh, vui lòng thử lại sau.'
    }
    return err.message || 'Có lỗi xảy ra, vui lòng thử lại.'
  }
  return 'Không thể kết nối máy chủ, vui lòng thử lại.'
}

function inputWrapCls(hasError: boolean): string {
  return cn(
    'flex h-10 items-center rounded-btn border bg-black/25 px-3 transition-colors focus-within:border-gold/70',
    hasError ? 'border-danger' : 'border-line-strong',
  )
}

/**
 * Hộp đăng nhập / đăng ký:
 * - Chế độ mock: đăng nhập nhanh bằng tài khoản mẫu.
 * - Chế độ api: form đăng nhập & đăng ký nối với backend + validate contracts.
 */
export function LoginModal({
  intent,
  onClose,
  redirectTo = '/dashboard',
}: {
  intent: LoginIntent | null
  onClose: () => void
  redirectTo?: string
}) {
  if (authAdapter.authFlow === 'supabase' && authAdapter.emailAuth) {
    return <SupabaseLoginModal intent={intent} onClose={onClose} redirectTo={redirectTo} />
  }
  if (authAdapter.authFlow === 'platform' || authAdapter.persistsWrites) {
    return <ApiLoginModal intent={intent} onClose={onClose} redirectTo={redirectTo} />
  }
  return <MockLoginModal intent={intent} onClose={onClose} redirectTo={redirectTo} />
}

function SupabaseLoginModal({
  intent,
  onClose,
  redirectTo,
}: {
  intent: LoginIntent | null
  onClose: () => void
  redirectTo: string
}) {
  const { login } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const uid = useId()
  const [tab, setTab] = useState<AuthTab>(intent === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [needsOtp, setNeedsOtp] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!intent) return
    setTab(intent === 'register' ? 'register' : 'login')
    setNeedsOtp(false)
    setOtp('')
    setError('')
  }, [intent])

  const finish = (user: Awaited<ReturnType<NonNullable<typeof authAdapter.emailAuth>['login']>>['user']) => {
    notify(needsOtp ? 'Xác minh thành công' : tab === 'register' ? 'Đăng ký thành công' : 'Đã đăng nhập', `Xin chào ${user.displayName}!`)
    navigate(redirectTo, { replace: true })
    startTransition(() => login(user))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting || !authAdapter.emailAuth) return
    setError('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Hãy nhập địa chỉ email hợp lệ.')
    if (!needsOtp && password.length < 8) return setError('Mật khẩu phải có ít nhất 8 ký tự.')
    if (tab === 'register' && !needsOtp && !displayName.trim()) return setError('Tên hiển thị không được để trống.')
    setSubmitting(true)
    try {
      if (needsOtp) {
        if (!otp.trim()) throw new Error('Hãy nhập mã OTP đã gửi tới email.')
        finish((await authAdapter.emailAuth.verifyOtp(email, otp)).user)
      } else if (tab === 'login') {
        finish((await authAdapter.emailAuth.login(email, password)).user)
      } else {
        const result = await authAdapter.emailAuth.signUp(email, password, displayName)
        if (result.needsOtp) {
          setNeedsOtp(true)
          notify('Đã gửi mã OTP', 'Kiểm tra hộp thư và nhập mã xác minh.')
        } else if (result.user) finish(result.user)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xác thực lúc này. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={intent !== null} onClose={onClose} title={needsOtp ? 'Xác minh email' : tab === 'register' ? TITLES.register : TITLES.login}>
      {!needsOtp && (
        <Tabs
          items={[{ id: 'login', label: 'Đăng nhập' }, { id: 'register', label: 'Đăng ký' }]}
          value={tab}
          onChange={(next) => { setTab(next); setError('') }}
          label="Chế độ tài khoản"
          idPrefix={`${uid}-supabase-auth`}
          itemClassName="h-10"
          stretch
        />
      )}
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
        {error && <p role="alert" className="rounded-btn border border-danger/40 bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
        <label className="text-sm font-medium">
          Email
          <span className={inputWrapCls(false)}>
            <input data-autofocus type="email" autoComplete="email" value={email} disabled={needsOtp} onChange={(event) => setEmail(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-base outline-none disabled:opacity-60" />
          </span>
        </label>
        {tab === 'register' && !needsOtp && (
          <label className="text-sm font-medium">
            Tên hiển thị
            <span className={inputWrapCls(false)}><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-base outline-none" /></span>
          </label>
        )}
        {needsOtp ? (
          <label className="text-sm font-medium">
            Mã OTP
            <span className={inputWrapCls(false)}><input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-base tracking-widest outline-none" /></span>
          </label>
        ) : (
          <label className="text-sm font-medium">
            Mật khẩu
            <span className={inputWrapCls(false)}><input type="password" autoComplete={tab === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-base outline-none" /></span>
          </label>
        )}
        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Để sau</Button>
          <Button type="submit" disabled={submitting} leftIcon={tab === 'register' ? <UserPlus size={17} aria-hidden /> : <LogIn size={17} aria-hidden />}>
            {submitting ? 'Đang xử lý…' : needsOtp ? 'Xác minh' : tab === 'register' ? 'Đăng ký' : 'Đăng nhập'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function MockLoginModal({
  intent,
  onClose,
  redirectTo,
}: {
  intent: LoginIntent | null
  onClose: () => void
  redirectTo: string
}) {
  const { login } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()

  return (
    <Modal open={intent !== null} onClose={onClose} title={intent ? TITLES[intent] : ''}>
      <p className="text-sm leading-relaxed text-fg-muted">
        Tính năng {intent === 'register' ? 'đăng ký' : 'đăng nhập'} thật đang phát triển. Bạn có thể vào bằng tài
        khoản mẫu để xem giao diện người dùng.
      </p>
      <div className="mt-5 flex items-center gap-3 rounded-btn border border-line bg-surface-2 p-3">
        <Avatar src={currentUser.avatar} alt="" size={44} rounded="lg" />
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold">{currentUser.name}</span>
          <LevelPill level={currentUser.level ?? 1} className="self-start" />
        </div>
        <span className="ml-auto text-xs text-fg-subtle">Tài khoản mẫu</span>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Để sau
        </Button>
        <Button
          data-autofocus
          leftIcon={<LogIn size={17} aria-hidden />}
          onClick={() => {
            notify('Đã đăng nhập (giả lập)', `Xin chào ${currentUser.name}!`)
            // Không gọi onClose trước: onClose xoá query ?next= ở landing và làm mất trang cần quay lại.
            // Điều hướng đi sẽ tự gỡ modal.
            navigate(redirectTo, { replace: true })
            // login phải nằm cùng transition với điều hướng (React Router v7 dùng startTransition).
            // Nếu gọi login() đồng bộ, landing render <Navigate> (= null) trong lúc chờ → trang trắng.
            startTransition(login)
          }}
        >
          Vào bằng tài khoản mẫu
        </Button>
      </div>
    </Modal>
  )
}

function ApiLoginModal({
  intent,
  onClose,
  redirectTo,
}: {
  intent: LoginIntent | null
  onClose: () => void
  redirectTo: string
}) {
  const { login } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const uid = useId()

  const [tab, setTab] = useState<AuthTab>(() => (intent === 'register' ? 'register' : 'login'))
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (intent === null) return
    setTab(intent === 'register' ? 'register' : 'login')
    setFieldErrors({})
    setServerError(null)
    setSubmitting(false)
  }, [intent])

  const clearFieldError = (field: FieldName) => {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    if (serverError) setServerError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setServerError(null)

    const normalizedUsername = username.trim().toLowerCase()
    const parsed =
      tab === 'register'
        ? RegisterBodySchema.safeParse({ username: normalizedUsername, displayName, password })
        : LoginBodySchema.safeParse({ username: normalizedUsername, password })

    if (!parsed.success) {
      const nextErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'username' || key === 'displayName' || key === 'password') {
          nextErrors[key] ??= FIELD_MESSAGES[key]
        }
      }
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    try {
      const res =
        tab === 'register'
          ? await authAdapter.register(RegisterBodySchema.parse(parsed.data))
          : await authAdapter.login(LoginBodySchema.parse(parsed.data))
      notify(tab === 'register' ? 'Đăng ký thành công' : 'Đã đăng nhập', `Xin chào ${res.user.displayName}!`)
      navigate(redirectTo, { replace: true })
      startTransition(() => login(res.user))
    } catch (err: unknown) {
      setServerError(formatServerError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const modalTitle = tab === 'register' ? TITLES.register : intent === 'start' ? TITLES.start : TITLES.login

  return (
    <Modal open={intent !== null} onClose={onClose} title={modalTitle}>
      <Tabs
        items={[
          { id: 'login', label: 'Đăng nhập' },
          { id: 'register', label: 'Đăng ký' },
        ]}
        value={tab}
        onChange={(nextTab) => {
          setTab(nextTab)
          setFieldErrors({})
          setServerError(null)
        }}
        label="Chế độ tài khoản"
        idPrefix={`${uid}-auth`}
        itemClassName="h-10"
        stretch
      />

      <form
        id={`${uid}-auth-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-auth-tab-${tab}`}
        onSubmit={handleSubmit}
        noValidate
        className="mt-4 flex flex-col gap-4"
      >
        {serverError && (
          <div role="alert" className="rounded-btn border border-danger/40 bg-danger-bg px-3 py-2 text-sm text-danger">
            {serverError}
          </div>
        )}

        <div>
          <label htmlFor={`${uid}-username`} className="mb-1 block text-sm font-medium text-fg">
            Tên đăng nhập
          </label>
          <div className={inputWrapCls(Boolean(fieldErrors.username))}>
            <input
              id={`${uid}-username`}
              data-autofocus
              type="text"
              autoComplete="username"
              placeholder="vd: suthy"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                clearFieldError('username')
              }}
              aria-invalid={fieldErrors.username ? true : undefined}
              aria-describedby={fieldErrors.username ? `${uid}-username-err` : undefined}
              className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
            />
          </div>
          {fieldErrors.username && (
            <p id={`${uid}-username-err`} role="alert" className="mt-1 text-xs text-danger">
              {fieldErrors.username}
            </p>
          )}
        </div>

        {tab === 'register' && (
          <div>
            <label htmlFor={`${uid}-displayName`} className="mb-1 block text-sm font-medium text-fg">
              Tên hiển thị
            </label>
            <div className={inputWrapCls(Boolean(fieldErrors.displayName))}>
              <input
                id={`${uid}-displayName`}
                type="text"
                autoComplete="nickname"
                placeholder="vd: Suthy"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  clearFieldError('displayName')
                }}
                aria-invalid={fieldErrors.displayName ? true : undefined}
                aria-describedby={fieldErrors.displayName ? `${uid}-displayName-err` : undefined}
                className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
              />
            </div>
            {fieldErrors.displayName && (
              <p id={`${uid}-displayName-err`} role="alert" className="mt-1 text-xs text-danger">
                {fieldErrors.displayName}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor={`${uid}-password`} className="mb-1 block text-sm font-medium text-fg">
            Mật khẩu
          </label>
          <div className={inputWrapCls(Boolean(fieldErrors.password))}>
            <input
              id={`${uid}-password`}
              type="password"
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearFieldError('password')
              }}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? `${uid}-password-err` : undefined}
              className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
            />
          </div>
          {fieldErrors.password && (
            <p id={`${uid}-password-err`} role="alert" className="mt-1 text-xs text-danger">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Để sau
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            leftIcon={tab === 'register' ? <UserPlus size={17} aria-hidden /> : <LogIn size={17} aria-hidden />}
          >
            {submitting
              ? tab === 'register'
                ? 'Đang đăng ký...'
                : 'Đang đăng nhập...'
              : tab === 'register'
                ? 'Đăng ký'
                : 'Đăng nhập'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
