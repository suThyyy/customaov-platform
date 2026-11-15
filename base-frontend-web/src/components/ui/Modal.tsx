import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  placement = 'center',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Ghi đè class của panel (vd. độ rộng) */
  className?: string
  /** 'top': neo gần đầu màn hình (hộp tìm kiếm) */
  placement?: 'center' | 'top'
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      // Ưu tiên [data-autofocus]; querySelector với danh sách selector trả về phần tử đầu tiên theo DOM nên phải tách
      const panel = panelRef.current
      ;(panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>('button'))?.focus()
    }, 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[90] grid justify-items-center p-4 sm:p-6',
        placement === 'top' ? 'items-start pt-[10vh]' : 'items-center',
      )}
    >
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm [animation:fade-in_160ms_ease-out]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'relative w-full max-w-[440px] rounded-card border border-line-strong bg-surface p-6 shadow-[0_24px_64px_-12px_rgb(0_0_0/0.8)] [animation:pop-in_200ms_var(--ease-out-soft)]',
          className,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-btn text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
        >
          <X size={18} aria-hidden />
        </button>
        <h2 id="modal-title" className="pr-8 text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
