import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Phân trang dạng số trang. Ẩn hoàn toàn khi chỉ có 1 trang.
 * Trang hiện tại có `aria-current="page"`.
 */
export function Pagination({
  page,
  totalPages,
  onChange,
  label = 'Phân trang',
  className,
}: {
  /** Trang hiện tại, bắt đầu từ 1 */
  page: number
  totalPages: number
  onChange: (page: number) => void
  label?: string
  className?: string
}) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const item =
    'inline-grid h-10 min-w-10 place-items-center rounded-btn px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40'

  return (
    <nav aria-label={label} className={cn('flex justify-center', className)}>
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          <button
            type="button"
            className={cn(item, 'text-fg-muted hover:bg-white/5 hover:text-fg')}
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label="Trang trước"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
        </li>
        {pages.map((p) => (
          <li key={p}>
            <button
              type="button"
              className={cn(
                item,
                p === page
                  ? 'bg-gold-tint text-gold ring-1 ring-gold/50'
                  : 'border border-line-strong text-fg hover:border-white/30 hover:bg-white/5',
              )}
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Trang ${p}`}
            >
              {p}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={cn(item, 'text-fg-muted hover:bg-white/5 hover:text-fg')}
            onClick={() => onChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Trang sau"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </li>
      </ul>
    </nav>
  )
}
