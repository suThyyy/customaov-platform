import { startTransition, useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, History, LogOut, UserRound } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAuth, useToast } from '../../context/AppContext'
import { authAdapter, currentUser } from '../../api'
import { Avatar, LevelPill } from '../ui/primitives'
import { useDismiss } from './hooks'

const itemCls = 'flex min-h-11 w-full items-center gap-3 rounded-btn px-3 text-left text-sm transition-colors'

/** Avatar + menu tài khoản ở TopNav (thay phần tương ứng trong Topbar cũ) */
export function UserMenu() {
  const navigate = useNavigate()
  const { user, logout, canOrganize, role } = useAuth()
  const { notify } = useToast()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  const displayName = user?.displayName ?? currentUser.name
  const avatarSrc = user ? (user.avatarUrl ?? undefined) : currentUser.avatar
  const level = user?.level ?? currentUser.level ?? 1

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Tài khoản ${displayName}`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2.5 rounded-btn p-1 transition-colors hover:bg-white/5"
      >
        <Avatar src={avatarSrc} name={displayName} alt="" size={36} rounded="lg" />
        <span className="hidden flex-col items-start gap-0.5 xl:flex">
          <span className="text-sm leading-none font-semibold">{displayName}</span>
          <LevelPill level={level} />
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn('hidden text-fg-muted transition-transform md:block', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Tài khoản"
          className="absolute top-[calc(100%+8px)] right-0 z-[70] w-[232px] rounded-card border border-line-strong bg-surface-2 p-1.5 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)] [animation:pop-in_160ms_var(--ease-out-soft)]"
        >
          <Link role="menuitem" to="/profile" onClick={close} className={cn(itemCls, 'hover:bg-white/5')}>
            <UserRound size={17} aria-hidden className="text-gold" /> Hồ sơ của tôi
          </Link>
          <span role="menuitem" aria-disabled="true" className={cn(itemCls, 'cursor-default text-fg-muted')}>
            <History size={17} aria-hidden /> Lịch sử hoạt động
            <SoonBadge className="ml-auto" />
          </span>
          <div className="my-1 h-px bg-line" />
          {canOrganize && <>
            <Link role="menuitem" to="/dashboard#rooms" onClick={close} className={itemCls}>Quản lý phòng</Link>
            <Link role="menuitem" to="/tournaments" onClick={close} className={itemCls}>Quản lý giải đấu</Link>
            <Link role="menuitem" to="/tournaments/new" onClick={close} className={itemCls}>Tạo giải đấu</Link>
          </>}
          {role === 'super_admin' && <Link role="menuitem" to="/platform-admin" onClick={close} className={itemCls}>Quản trị nền tảng</Link>}
          <button
            role="menuitem"
            type="button"
            disabled={loggingOut}
            onClick={async () => {
              if (loggingOut) return
              if (authAdapter.persistsWrites) {
                setLoggingOut(true)
                try {
                  await authAdapter.logout()
                } catch {
                  // Vẫn xoá trạng thái phiên ở client nếu server lỗi
                } finally {
                  setLoggingOut(false)
                }
              }
              close()
              notify(
                authAdapter.persistsWrites ? 'Đã đăng xuất' : 'Đã đăng xuất (giả lập)',
                'Bạn đang xem giao diện khách.',
              )
              navigate('/')
              // React Router v7 điều hướng trong startTransition; logout cũng phải nằm trong transition
              // để render một lần với (location '/', khách). Nếu không, RequireAuth sẽ render trước trên
              // route cũ và đẩy sang /?login=… → người vừa đăng xuất lại thấy hộp đăng nhập.
              startTransition(logout)
            }}
            className={cn(itemCls, 'text-fg-muted hover:bg-white/5 hover:text-fg disabled:opacity-50')}
          >
            <LogOut size={17} aria-hidden /> {authAdapter.persistsWrites ? 'Đăng xuất' : 'Đăng xuất (giả lập)'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Badge "Sắp có" cho mục chưa làm */
export function SoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full bg-surface-4 px-1.5 py-px text-xs font-medium whitespace-nowrap text-fg-muted',
        className,
      )}
    >
      Sắp có
    </span>
  )
}
