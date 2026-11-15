import type { ReactNode } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { LoadStatus } from '../../api'
import { Button } from './Button'

/** Khối xám nhấp nháy giữ chỗ khi đang tải */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse rounded-btn bg-surface-3', className)} />
}

/** N hàng danh sách: ô tròn + 2 dòng chữ */
export function SkeletonRows({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <ul aria-hidden className={cn('flex flex-col', className)}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={cn('flex items-center gap-3 py-3', i > 0 && 'border-t border-line')}>
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </span>
          <Skeleton className="h-8 w-20 shrink-0" />
        </li>
      ))}
    </ul>
  )
}

/** N thẻ (ảnh + chữ) cho lưới card */
export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <ul aria-hidden className={cn('grid gap-6', className)}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-card border border-line bg-surface/90">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-10 w-full" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ErrorState({ title, onRetry, className }: { title: string; onRetry: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-danger/30 bg-danger-bg/30 px-6 py-8 text-center',
        className,
      )}
    >
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-danger-bg text-danger">
        <TriangleAlert size={24} />
      </span>
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-[46ch] text-sm text-fg-muted">Kiểm tra kết nối mạng rồi thử lại.</p>
      <Button variant="outline" size="sm" leftIcon={<RefreshCw size={16} aria-hidden />} onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  )
}

/**
 * Bọc một danh sách: loading → skeleton (kèm thông báo cho trình đọc màn hình), error → ErrorState,
 * ready → children (children tự lo empty state).
 */
export function ListStatus({
  status,
  onRetry,
  label,
  skeleton,
  className,
  children,
}: {
  status: LoadStatus
  onRetry: () => void
  /** Tên danh sách, vd "danh sách phòng" */
  label: string
  skeleton: ReactNode
  className?: string
  children: ReactNode
}) {
  if (status === 'loading') {
    return (
      <div role="status" aria-busy="true" className={className}>
        <span className="sr-only">Đang tải {label}…</span>
        {skeleton}
      </div>
    )
  }
  if (status === 'error') return <ErrorState className={className} title={`Không tải được ${label}`} onRetry={onRetry} />
  return <>{children}</>
}
