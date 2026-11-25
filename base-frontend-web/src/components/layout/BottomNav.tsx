import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useAuth } from '../../context/AppContext'
import { bottomNavItems } from './nav'

/**
 * Điều hướng đáy màn hình cho < 768px: Trang chủ · Phòng · Tạo (+) · Giải đấu · Hồ sơ.
 * Mỗi mục có vùng chạm ≥ 44×44px; chừa safe-area cho iPhone (env(safe-area-inset-bottom)).
 * Trang dùng BottomNav phải chừa khoảng trống đáy bằng class `pb-bottom-nav` (xem index.css).
 */
export function BottomNav() {
  const { loggedIn, canOrganize } = useAuth()
  const { pathname, hash } = useLocation()

  return (
    <nav
      aria-label="Điều hướng nhanh"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-[var(--bottom-nav-h)] grid-cols-6">
        {bottomNavItems(loggedIn, canOrganize).map((item) => {
          const Icon = item.icon
          const active = item.isActive?.(pathname, hash) ?? false
          return (
            <li key={item.label} className="flex">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                aria-label={item.primary ? item.label : undefined}
                className={cn(
                  'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors',
                  active ? 'font-semibold text-gold' : 'text-fg-muted hover:text-fg',
                )}
              >
                {item.primary ? (
                  <span
                    aria-hidden
                    className={cn(
                      '-mt-5 grid size-14 place-items-center rounded-full bg-gold-gradient text-gold-ink shadow-[var(--shadow-gold)] ring-4 ring-sidebar',
                      active && 'brightness-110',
                    )}
                  >
                    <Icon size={26} strokeWidth={2.4} />
                  </span>
                ) : (
                  <>
                    <Icon size={22} aria-hidden strokeWidth={active ? 2.2 : 1.8} />
                    <span>{item.label}</span>
                  </>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
