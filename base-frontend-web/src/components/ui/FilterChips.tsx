import { cn } from '../../lib/cn'

/**
 * Nhóm nút lọc (chọn 1). Mục đang chọn dùng nền vàng nhạt + viền vàng, KHÔNG dùng vàng đặc
 * (nút vàng đặc dành cho hành động chính duy nhất của màn).
 * Cuộn ngang được trên màn hẹp thay vì xuống dòng.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: ReadonlyArray<{ id: T; label: string; count?: number }>
  value: T
  onChange: (id: T) => void
  /** aria-label cho nhóm */
  label: string
  className?: string
}) {
  return (
    <div className={cn('relative -mx-1 min-w-0 overflow-x-auto px-1 py-1', className)}>
      <div role="group" aria-label={label} className="flex w-max gap-2">
        {options.map((o) => {
          const active = o.id === value
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.id)}
              className={cn(
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-btn px-4 text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-150',
                active
                  ? 'bg-gold-tint text-gold ring-1 ring-gold/60'
                  : 'border border-line-strong bg-surface/80 text-fg hover:border-white/30 hover:bg-surface-3',
              )}
            >
              {o.label}
              {o.count !== undefined && (
                <span
                  className={cn(
                    'tabular rounded-full px-2 text-xs',
                    active ? 'bg-gold/15 text-gold' : 'bg-white/5 text-fg-muted',
                  )}
                >
                  {o.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
