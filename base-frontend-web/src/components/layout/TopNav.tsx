import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, ChevronDown, Plus, Search } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAuth, useToast } from '../../context/AppContext'
import { ButtonLink } from '../ui/Button'
import { Brand } from './Brand'
import { Container } from './Container'
import { GUEST_NAV, loginHref, USER_NAV, type NavItem } from './nav'
import { SearchDialog } from './SearchDialog'
import { SoonBadge, UserMenu } from './UserMenu'
import { useDismiss } from './hooks'

const iconBtn =
  'relative grid size-11 shrink-0 place-items-center rounded-full text-fg transition-colors hover:bg-white/5'

/**
 * Thanh điều hướng chính, sticky, cao 56px (mobile) / 64px (từ 768px), nền đặc.
 * - < 768px: logo + tìm kiếm + avatar (hoặc Đăng nhập); điều hướng chuyển xuống BottomNav
 * - ≥ 768px: mục chính + menu "Thêm" (gom mục Sắp có ở mọi khổ: header tối đa 1440px nên
 *   không đủ chỗ hiện inline khi đã đăng nhập); < 1024px nút Tạo phòng chỉ còn icon
 * - ≥ 1280px: ô tìm kiếm dạng nút rộng có Ctrl K, hiện tên người dùng
 */
export function TopNav() {
  const { loggedIn } = useAuth()
  const { comingSoon } = useToast()
  const { pathname, hash } = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  const items = loggedIn ? USER_NAV : GUEST_NAV
  const primary = items.filter((i) => !i.secondary)
  const secondary = items.filter((i) => i.secondary)

  // Ctrl/⌘ + K mở hộp tìm kiếm
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="sticky top-0 z-[60] h-[var(--header-h)] border-b border-line bg-sidebar">
      <Container wide className="flex h-full items-center gap-2 md:gap-4">
        <Brand to={loggedIn ? '/dashboard' : '/'} variant="compact" />

        <nav aria-label="Điều hướng chính" className="hidden h-full min-w-0 md:block">
          <ul className="flex h-full items-center gap-1">
            {primary.map((item) => (
              <li key={item.label} className="h-full">
                <TopNavLink item={item} active={item.isActive?.(pathname, hash) ?? false} />
              </li>
            ))}
            {secondary.length > 0 && (
              <li className="h-full">
                <MoreMenu items={secondary} />
              </li>
            )}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Tìm kiếm (Ctrl K)"
            className={cn(
              iconBtn,
              'xl:w-[220px] xl:justify-start xl:gap-2.5 xl:rounded-btn xl:border xl:border-line xl:bg-surface-2/80 xl:px-3 xl:text-fg-muted xl:hover:border-line-strong',
              'xl:flex xl:h-10',
            )}
          >
            <Search size={19} aria-hidden />
            <span className="hidden text-sm xl:inline">Tìm kiếm...</span>
            <kbd className="ml-auto hidden rounded-btn bg-surface-3 px-1.5 py-0.5 font-sans text-xs xl:inline">Ctrl K</kbd>
          </button>

          {loggedIn ? (
            <>
              {/* Bọc wrapper để ẩn ở mobile (tránh xung đột `hidden` với `inline-flex`/`grid` của nút) */}
              <div className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  onClick={() => comingSoon('Thông báo')}
                  aria-label="Thông báo (có thông báo mới)"
                  className={iconBtn}
                >
                  <Bell size={21} aria-hidden strokeWidth={1.8} />
                  <span aria-hidden className="absolute top-2.5 right-3 size-2 rounded-full bg-notify ring-2 ring-sidebar" />
                </button>
                {/* Viền vàng (không đặc) để mỗi màn chỉ còn 1 nút vàng chính nằm trong nội dung trang */}
                <ButtonLink
                  to="/rooms/new"
                  variant="gold-outline"
                  aria-label="Tạo phòng"
                  className="h-10 w-11 px-0 lg:w-auto lg:px-4"
                  leftIcon={<Plus size={20} aria-hidden />}
                >
                  <span className="hidden lg:inline">Tạo phòng</span>
                </ButtonLink>
              </div>
              <UserMenu />
            </>
          ) : (
            <>
              <ButtonLink to={loginHref('login', pathname === '/' ? undefined : pathname)} variant="ghost" className="h-10">
                Đăng nhập
              </ButtonLink>
              <div className="hidden sm:block">
                <ButtonLink to={loginHref('register', pathname === '/' ? undefined : pathname)} variant="gold-outline" className="h-10">
                  Đăng ký
                </ButtonLink>
              </div>
            </>
          )}
        </div>
      </Container>

      <SearchDialog open={searchOpen} onClose={closeSearch} />
    </header>
  )
}

const linkCls =
  'relative flex h-full items-center gap-2 px-3 text-base whitespace-nowrap transition-colors'

function TopNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to!}
      aria-current={active ? 'page' : undefined}
      className={cn(linkCls, active ? 'font-semibold text-gold' : 'text-fg/85 hover:text-fg')}
    >
      {item.label}
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-gold-gradient transition-opacity',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
    </Link>
  )
}


function MoreMenu({ items }: { items: NavItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  return (
    <div ref={ref} className="relative h-full">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(linkCls, 'text-fg/85 hover:text-fg')}
      >
        Thêm
        <ChevronDown size={16} aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Mục khác"
          className="absolute top-[calc(100%+4px)] left-0 z-[70] w-[220px] rounded-card border border-line-strong bg-surface-2 p-1.5 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)] [animation:pop-in_160ms_var(--ease-out-soft)]"
        >
          {items.map((item) => {
            const Icon = item.icon
            return (
              <span
                key={item.label}
                role="menuitem"
                aria-disabled="true"
                className="flex min-h-11 items-center gap-3 rounded-btn px-3 text-sm text-fg-muted"
              >
                <Icon size={17} aria-hidden />
                {item.label}
                <SoonBadge className="ml-auto" />
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
