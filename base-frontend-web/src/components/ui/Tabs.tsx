import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
  icon?: ReactNode
}

/**
 * Tabs gạch chân vàng (dùng ở Phòng custom, Chi tiết giải, Hồ sơ).
 * Hỗ trợ phím ← → Home End theo mẫu WAI-ARIA tabs.
 * Màn hẹp: thanh tab cuộn ngang, có bóng mờ ở mép còn tab bị khuất; tab đang chọn luôn được cuộn vào khung (Phase 5).
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  className,
  itemClassName,
  stretch,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  idPrefix: string
  className?: string
  itemClassName?: string
  stretch?: boolean
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const listRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
  }, [])

  useEffect(() => {
    measure()
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  // Tab đang chọn nằm ngoài khung (vd. mở thẳng ?tab=results trên mobile) → cuộn ngang tới nó, không cuộn trang
  const activeIdx = items.findIndex((i) => i.id === value)
  useEffect(() => {
    const ensureVisible = () => {
      const list = listRef.current
      const tab = refs.current[activeIdx]
      if (!list || !tab) return
      // tablist là `relative` → offsetParent của tab chính là tablist
      const left = tab.offsetLeft
      const right = left + tab.offsetWidth
      if (left < list.scrollLeft) list.scrollLeft = Math.max(0, left - 24)
      else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth + 24
      measure()
    }
    ensureVisible()
    // Font web tải xong làm tab rộng ra → đo lại
    let alive = true
    document.fonts?.ready.then(() => alive && ensureVisible())
    return () => {
      alive = false
    }
  }, [activeIdx, measure])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = items.findIndex((i) => i.id === value)
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else return
    e.preventDefault()
    onChange(items[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div className="relative">
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        onScroll={measure}
        className={cn('relative flex overflow-x-auto overflow-y-hidden border-b border-line', className)}
      >
        {items.map((item, i) => {
          const active = item.id === value
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              role="tab"
              type="button"
              id={`${idPrefix}-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(item.id)}
              className={cn(
                'relative -mb-px inline-flex shrink-0 items-center justify-center gap-2 px-5 text-base whitespace-nowrap transition-colors duration-150',
                stretch && 'flex-1',
                active ? 'font-semibold text-gold' : 'text-fg-muted hover:text-fg',
                itemClassName,
              )}
            >
              {item.icon && <span aria-hidden>{item.icon}</span>}
              {item.label}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-gold-gradient transition-[opacity,transform] duration-200',
                  active ? 'scale-x-100 opacity-100' : 'scale-x-50 opacity-0',
                )}
              />
            </button>
          )
        })}
      </div>
      {/* Bóng mờ gợi ý còn tab bị khuất (nằm ngoài vùng cuộn) */}
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
