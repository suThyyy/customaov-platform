// @deprecated – thay bằng TopNav (UI refactor 11/2026)
import { NavLink, useLocation } from 'react-router-dom'
import { BarChart3, Gamepad2, History, House, Trophy, UsersRound, type LucideIcon } from 'lucide-react'
import { asset } from '../../lib/asset'
import { cn } from '../../lib/cn'
import { useToast } from '../../context/AppContext'
import { Brand } from './Brand'

interface NavItem {
  label: string
  icon: LucideIcon
  to?: string
  /** Prefix route để đánh dấu active */
  match?: string[]
}

const NAV: NavItem[] = [
  { label: 'Trang chủ', icon: House, to: '/dashboard', match: ['/dashboard'] },
  { label: 'Phòng custom', icon: Gamepad2, to: '/rooms/AOV-1024', match: ['/rooms'] },
  { label: 'Giải đấu mini', icon: Trophy, to: '/tournaments', match: ['/tournaments'] },
  { label: 'Bảng xếp hạng', icon: BarChart3 },
  { label: 'Cộng đồng', icon: UsersRound },
  { label: 'Lịch sử', icon: History },
]

const itemCls =
  'group relative flex h-12 w-full items-center gap-4 rounded-[10px] pr-3 pl-7 text-[16.5px] transition-colors duration-150'

export function Sidebar() {
  const { pathname } = useLocation()
  const { comingSoon } = useToast()

  return (
    <aside
      aria-label="Điều hướng chính"
      className="sticky top-0 flex h-dvh w-[258px] shrink-0 flex-col overflow-hidden border-r border-line bg-sidebar"
    >
      <div className="pt-2 pr-2 pl-[26px]">
        <Brand to="/dashboard" />
      </div>

      <nav className="relative z-10 mt-[44px] px-[15px]">
        <ul className="flex flex-col gap-2">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = item.match?.some((m) => pathname.startsWith(m)) ?? false
            const content = (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-0 left-0 h-full w-[4px] rounded-l-[10px] bg-gold transition-opacity',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <Icon
                  size={22}
                  aria-hidden
                  className={cn(active ? 'fill-gold/90 text-gold' : 'text-fg-muted group-hover:text-fg')}
                  strokeWidth={active ? 2 : 1.8}
                />
                <span>{item.label}</span>
              </>
            )
            const cls = cn(
              itemCls,
              active
                ? 'bg-[linear-gradient(90deg,rgb(242_180_99/0.16),rgb(255_255_255/0.05))] font-medium text-gold'
                : 'text-fg/90 hover:bg-white/[0.04] hover:text-fg',
            )
            return (
              <li key={item.label}>
                {item.to ? (
                  <NavLink to={item.to} className={cls} aria-current={active ? 'page' : undefined}>
                    {content}
                  </NavLink>
                ) : (
                  <button type="button" className={cn(cls, 'text-left')} onClick={() => comingSoon(item.label)}>
                    {content}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <div aria-hidden className="mx-5 mt-5 h-px bg-line" />
      </nav>

      {/* Tranh lâu đài trang trí ở chân sidebar (placeholder cắt từ mock) */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[340px]">
        <img src={asset('sidebar-art.jpg')} alt="" className="size-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--color-sidebar)_0%,transparent_45%)]" />
      </div>
    </aside>
  )
}
