import { useCallback, useRef, useState } from 'react'
import { MoreVertical, RefreshCw, RotateCcw, UserMinus } from 'lucide-react'
import type { OpenRoomPending } from '../../../api'
import { cn } from '../../../lib/cn'
import { useDismiss } from '../../layout/hooks'
import { IconButton } from '../../ui/Button'

export function ParticipantMenu({
  memberId,
  displayName,
  isHostMember = false,
  canKick,
  canRequeue,
  canReplace,
  pending,
  onKick,
  onRequeue,
  onReplace,
}: {
  memberId: string
  displayName: string
  isHostMember?: boolean
  canKick: boolean
  canRequeue: boolean
  canReplace: boolean
  pending: OpenRoomPending
  onKick: (memberId: string, displayName: string) => void
  onRequeue: (memberId: string, displayName: string) => void
  onReplace: (memberId: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  if (!canKick && !canRequeue && !canReplace) return null

  const itemClass =
    'flex min-h-11 w-full items-center gap-3 rounded-btn px-3 text-left text-sm transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'

  return (
    <div ref={ref} className="relative shrink-0">
      <IconButton
        label={`Tuỳ chọn cho ${displayName}`}
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        className="size-8"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical size={18} aria-hidden />
      </IconButton>
      {open && (
        <div
          role="menu"
          aria-label={`Tuỳ chọn cho ${displayName}`}
          className="absolute top-full right-0 z-30 mt-1 w-56 rounded-card border border-line-strong bg-surface-2 p-1 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)]"
        >
          {canReplace && (
            <button
              role="menuitem"
              type="button"
              disabled={pending.replace}
              className={itemClass}
              onClick={() => {
                close()
                onReplace(memberId)
              }}
            >
              <RefreshCw size={16} aria-hidden className="text-gold" />
              {pending.replace ? 'Đang thay người…' : 'Thay người'}
            </button>
          )}
          {canRequeue && (
            <button
              role="menuitem"
              type="button"
              disabled={pending.requeue}
              className={itemClass}
              onClick={() => {
                close()
                onRequeue(memberId, displayName)
              }}
            >
              <RotateCcw size={16} aria-hidden className="text-fg-muted" />
              Đưa về cuối hàng chờ
            </button>
          )}
          {canKick && (
            <button
              role="menuitem"
              type="button"
              disabled={pending.kick || isHostMember}
              title={isHostMember ? 'Không thể mời chủ phòng ra khỏi phòng' : undefined}
              className={cn(itemClass, 'text-danger')}
              onClick={() => {
                close()
                onKick(memberId, displayName)
              }}
            >
              <UserMinus size={16} aria-hidden />
              Mời ra khỏi phòng
            </button>
          )}
        </div>
      )}
    </div>
  )
}
