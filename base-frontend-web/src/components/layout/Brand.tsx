import { Link } from 'react-router-dom'
import { asset } from '../../lib/asset'

/**
 * Logo + tên "Đấu Trường Lập Đội" (logo là ảnh cắt từ mock — placeholder).
 * - compact: dùng trong TopNav (logo 40px; tên 1 dòng, ẩn dưới 1024px)
 */
export function Brand({ to }: { to: string; variant?: 'compact' }) {
  return (
    <Link
      to={to}
      className="group flex min-h-11 shrink-0 items-center gap-2.5 rounded-btn"
      aria-label="Đấu Trường Lập Đội - về trang chủ"
    >
      <img
        src={asset('logo.png')}
        alt=""
        aria-hidden
        className="size-10 shrink-0 object-contain mix-blend-lighten transition-transform duration-200 group-hover:scale-[1.04]"
      />
      <span className="hidden font-display text-base leading-tight font-bold whitespace-nowrap text-fg lg:block">
        Đấu Trường Lập Đội
      </span>
    </Link>
  )
}
