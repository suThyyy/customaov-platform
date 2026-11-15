import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Thẻ tính năng có icon vàng + tiêu đề + mô tả + mũi tên (landing).
 * Truyền `to` để thẻ là liên kết thật (ưu tiên); `onClick` chỉ dùng khi không có route.
 * Ghi chú Phase 4a: dashboard không còn dùng thẻ này (thay bằng "Công cụ nhanh" ở cột phụ); biến thể `sm` hiện không dùng.
 */
export function FeatureCard({
  icon,
  title,
  description,
  to,
  onClick,
  size = 'sm',
}: {
  icon: ReactNode
  title: string
  description: ReactNode
  to?: string
  onClick?: () => void
  size?: 'sm' | 'lg'
}) {
  const lg = size === 'lg'
  const cls = cn(
    'group flex w-full items-center rounded-card border border-line bg-surface/85 text-left backdrop-blur-sm',
    'transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-gold/40 hover:bg-surface-2',
    // min-h thay vì h cố định: tiêu đề/mô tả được xuống dòng trên màn hẹp thay vì bị cắt
    lg ? 'min-h-24 gap-4 p-4 sm:gap-6 sm:pl-6' : 'min-h-20 gap-3 py-2 pr-2 pl-4',
  )
  const inner = (
    <>
      <span aria-hidden className={cn('shrink-0 text-gold', lg ? '[&_svg]:size-10' : '[&_svg]:size-8')}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        {/* Tiêu đề không cắt chữ (Definition of Done #2) */}
        <span className={cn('block font-semibold text-fg', lg ? 'text-lg' : 'text-sm')}>{title}</span>
        <span
          title={!lg && typeof description === 'string' ? description : undefined}
          className={cn('mt-1 block text-fg-muted', lg ? 'text-sm' : 'truncate text-xs')}
        >
          {description}
        </span>
      </span>
      <ChevronRight
        size={lg ? 22 : 18}
        aria-hidden
        className="shrink-0 text-fg-muted transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-gold"
      />
    </>
  )
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    )
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}
