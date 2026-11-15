import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Thẻ tính năng có icon vàng + tiêu đề + mô tả + mũi tên (landing).
 * Truyền `to` để thẻ là liên kết thật (ưu tiên); `onClick` chỉ dùng khi không có route.
 * Ghi chú Phase 4a: dashboard không còn dùng thẻ này (thay bằng "Công cụ nhanh" ở cột phụ).
 */
export function FeatureCard({
  icon,
  title,
  description,
  to,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: ReactNode
  to?: string
  onClick?: () => void
}) {
  const cls = cn(
    'group flex w-full items-center rounded-card border border-line bg-surface/85 text-left backdrop-blur-sm',
    'transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-gold/40 hover:bg-surface-2',
    // min-h thay vì h cố định: tiêu đề/mô tả được xuống dòng trên màn hẹp thay vì bị cắt
    'min-h-24 gap-4 p-4 sm:gap-6 sm:pl-6',
  )
  const inner = (
    <>
      <span aria-hidden className="shrink-0 text-gold [&_svg]:size-10">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        {/* Tiêu đề không cắt chữ (Definition of Done #2) */}
        <span className="block font-semibold text-lg text-fg">{title}</span>
        <span
          className="mt-1 block text-sm text-fg-muted"
        >
          {description}
        </span>
      </span>
      <ChevronRight
        size={22}
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
