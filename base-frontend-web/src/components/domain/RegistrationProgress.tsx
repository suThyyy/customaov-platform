import { UsersRound } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Tiến độ đăng ký giải: "11/16 đội đã đăng ký" + thanh tiến độ.
 * Dùng ở card danh sách giải, banner chi tiết giải và promo card dashboard.
 */
export function RegistrationProgress({
  registered,
  total,
  className,
}: {
  registered: number
  total: number
  className?: string
}) {
  const pct = total > 0 ? Math.min(100, Math.round((registered / total) * 100)) : 0
  const left = Math.max(0, total - registered)
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <p className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
        <span className="flex items-center gap-1.5 text-fg">
          <UsersRound size={15} aria-hidden className="text-gold" />
          <span className="tabular font-semibold">
            {registered}/{total}
          </span>
          đội đã đăng ký
        </span>
        <span className="text-fg-muted">{left > 0 ? `Còn ${left} chỗ` : 'Đã đủ đội'}</span>
      </p>
      <div
        role="progressbar"
        aria-label="Tiến độ đăng ký"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={registered}
        aria-valuetext={`${registered} trên ${total} đội`}
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
      >
        <span className="block h-full rounded-full bg-gold-gradient" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
