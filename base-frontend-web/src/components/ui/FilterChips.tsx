import { useCallback, useEffect, useRef, useState } from 'react'
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
  }, [])

  useEffect(() => {
    measure()
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [measure, options.length])

  return (
    <div className={cn('relative -mx-1 min-w-0', className)}>
      <div ref={scrollRef} onScroll={measure} className="relative min-w-0 overflow-x-auto px-1 py-1">
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
      {/* Bóng mờ gợi ý còn chip bị khuất (nằm ngoài vùng cuộn) */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-8 bg-[linear-gradient(90deg,var(--color-bg),transparent)] transition-opacity',
          edges.left ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-8 bg-[linear-gradient(270deg,var(--color-bg),transparent)] transition-opacity',
          edges.right ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
