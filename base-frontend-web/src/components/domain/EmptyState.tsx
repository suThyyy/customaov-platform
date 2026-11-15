import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Trạng thái rỗng / chưa có nội dung (tab chưa phát triển, không tìm thấy dữ liệu…) */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  as: Title = 'p',
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** Thẻ của tiêu đề. Dùng 'h1' khi empty state là toàn bộ trang (404, không tìm thấy phòng/giải/người chơi). */
  as?: 'p' | 'h1' | 'h2'
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line-strong bg-surface/40 px-6 py-8 text-center',
        className,
      )}
    >
      <span aria-hidden className="grid size-14 place-items-center rounded-full bg-gold-tint text-gold">
        {icon}
      </span>
      <Title className="text-base font-semibold">{title}</Title>
      {description && <p className="max-w-[46ch] text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
