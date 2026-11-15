import { BarChart3, Gamepad2, House, Plus, Sparkles, Trophy, UserRound, UsersRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  /** Nhãn ngắn cho khổ hẹp / bottom nav */
  short?: string
  icon: LucideIcon
  /** Đích liên kết; bỏ trống = mục "Sắp có" (không bấm được) */
  to?: string
  /** Hàm xác định active theo pathname + hash */
  isActive?: (pathname: string, hash: string) => boolean
  /** Mục phụ: ở 768–1279px gom vào menu "Thêm" */
  secondary?: boolean
}

const isRoomDetail = (p: string) => p.startsWith('/rooms/') && p !== '/rooms/new'

/** Menu chính khi đã đăng nhập */
export const USER_NAV: NavItem[] = [
  { label: 'Trang chủ', icon: House, to: '/dashboard', isActive: (p, h) => p === '/dashboard' && h !== '#rooms' },
  { label: 'Phòng', icon: Gamepad2, to: '/dashboard#rooms', isActive: (p, h) => isRoomDetail(p) || (p === '/dashboard' && h === '#rooms') },
  { label: 'Giải đấu', icon: Trophy, to: '/tournaments', isActive: (p) => p.startsWith('/tournaments') },
  { label: 'Bảng xếp hạng', short: 'BXH', icon: BarChart3, secondary: true },
  { label: 'Cộng đồng', icon: UsersRound, secondary: true },
]

const LANDING_ANCHORS = ['#features', '#community']

/** Menu chính cho khách (landing + các trang công khai) */
export const GUEST_NAV: NavItem[] = [
  { label: 'Trang chủ', icon: House, to: '/', isActive: (p, h) => p === '/' && !LANDING_ANCHORS.includes(h) },
  { label: 'Tính năng', icon: Sparkles, to: '/#features', isActive: (p, h) => p === '/' && h === '#features' },
  { label: 'Giải đấu', icon: Trophy, to: '/tournaments', isActive: (p) => p.startsWith('/tournaments') },
  // Landing: anchor tới section "Cộng đồng" (số liệu cộng đồng + giải nổi bật)
  { label: 'Cộng đồng', icon: UsersRound, to: '/#community', isActive: (p, h) => p === '/' && h === '#community' },
  { label: 'Bảng xếp hạng', short: 'BXH', icon: BarChart3, secondary: true },
]

/** Đường dẫn mở hộp đăng nhập ở landing rồi quay lại `next` */
export const loginHref = (intent: 'login' | 'register' | 'start', next?: string): string =>
  `/?login=${intent}${next ? `&next=${encodeURIComponent(next)}` : ''}`

export interface BottomNavItem {
  label: string
  icon: LucideIcon
  to: string
  isActive?: (pathname: string, hash: string) => boolean
  /** Nút "Tạo (+)" nổi bật ở giữa */
  primary?: boolean
}

export function bottomNavItems(loggedIn: boolean): BottomNavItem[] {
  return [
    {
      label: 'Trang chủ',
      icon: House,
      to: loggedIn ? '/dashboard' : '/',
      isActive: (p, h) => (p === '/dashboard' || p === '/') && h !== '#rooms',
    },
    {
      label: 'Phòng',
      icon: Gamepad2,
      to: loggedIn ? '/dashboard#rooms' : '/#rooms',
      isActive: (p, h) => isRoomDetail(p) || h === '#rooms',
    },
    {
      label: 'Tạo phòng',
      icon: Plus,
      to: loggedIn ? '/rooms/new' : loginHref('start', '/rooms/new'),
      isActive: (p) => p === '/rooms/new',
      primary: true,
    },
    { label: 'Giải đấu', icon: Trophy, to: '/tournaments', isActive: (p) => p.startsWith('/tournaments') },
    {
      label: 'Hồ sơ',
      icon: UserRound,
      to: loggedIn ? '/profile' : loginHref('login', '/profile'),
      isActive: (p) => p.startsWith('/profile'),
    },
  ]
}
