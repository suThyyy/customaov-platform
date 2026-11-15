import { Link } from 'react-router-dom'
import { asset } from '../../lib/asset'
import { cn } from '../../lib/cn'

/**
 * Logo + tên "Đấu Trường Lập Đội" (logo là ảnh cắt từ mock — placeholder).
 * - compact: dùng trong TopNav (logo 40px; tên 1 dòng, ẩn dưới 1024px)
 * - sidebar / header: biến thể cũ (Sidebar, header landing trước refactor)
 */
export function Brand({ to, variant = 'sidebar' }: { to: string; variant?: 'sidebar' | 'header' | 'compact' }) {
  if (variant === 'compact') {
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

  const header = variant === 'header'
  return (
    <Link to={to} className="group flex items-center gap-2.5 rounded-btn" aria-label="Đấu Trường Lập Đội - về trang chủ">
      <img
        src={asset('logo.png')}
        alt=""
        aria-hidden
        className={cn(
          'shrink-0 mix-blend-lighten transition-transform duration-200 group-hover:scale-[1.04]',
          header ? 'size-[46px]' : 'size-[54px]',
        )}
      />
      <span className="flex flex-col">
        <span className={cn('font-display font-bold leading-[1.2] text-fg', header ? 'text-base' : 'text-lg')}>
          Đấu Trường
          <br />
          Lập Đội
        </span>
        <span className={cn('mt-1 text-xs text-fg-muted', header && 'mt-0.5')}>
          {header ? 'customAOV Community' : 'Custom AOV Community'}
        </span>
      </span>
    </Link>
  )
}
