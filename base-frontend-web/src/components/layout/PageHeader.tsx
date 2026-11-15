import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * Đầu trang nội bộ gọn (thay banner ảnh lớn): tiêu đề + mô tả + nút hành động + tab.
 * - leading: phần tử trước tiêu đề (vd. avatar ở trang hồ sơ)
 * - meta: dòng thông tin phụ dưới mô tả (chip, mã phòng…)
 * - tabs: thanh tab đặt sát dưới header
 */
export function PageHeader({
  title,
  description,
  actions,
  tabs,
  leading,
  meta,
  eyebrow,
  flush,
  className,
}: {
  /** Bỏ khoảng đệm phía trên (khi PageHeader nằm ngay dưới ảnh bìa) */
  flush?: boolean
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  tabs?: ReactNode
  leading?: ReactNode
  meta?: ReactNode
  eyebrow?: ReactNode
  className?: string
}) {
  return (
    <header className={cn(flush ? 'pt-3' : 'pt-6 md:pt-8', className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {leading && <div className="shrink-0">{leading}</div>}
          <div className="min-w-0">
            {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
            <h1 className="font-display text-2xl font-bold text-fg sm:text-4xl">{title}</h1>
            {description && <p className="mt-1.5 max-w-[65ch] text-base text-fg-muted">{description}</p>}
            {meta && <div className="mt-3">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
      </div>
      {tabs && <div className="mt-5">{tabs}</div>}
    </header>
  )
}
