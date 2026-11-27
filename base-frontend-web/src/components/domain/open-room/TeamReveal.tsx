import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { FastForward } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Button } from '../../ui/Button'
import { planReveal, REVEAL_TIMING, revealDuration, type PlannedEntry, type RevealEntry, type RevealVariant } from './revealPlan'

/*
 * Team Reveal (HUY-23) — lớp TRÌNH DIỄN thuần.
 * - Chỉ đọc `entries` authoritative; không bao giờ gọi mutation hay đổi đội/tướng/đường.
 * - Kết thúc bằng bộ hẹn giờ (không phụ thuộc animationend), có nút Bỏ qua, tôn trọng reduced-motion.
 * - Mỗi khoá chỉ phát một lần trong phiên (sessionStorage) để re-render/refresh/reconnect không phát lại.
 */

const STORAGE_PREFIX = 'customaov.reveal:'
const playedInMemory = new Set<string>()

function wasPlayed(key: string): boolean {
  if (playedInMemory.has(key)) return true
  try { return window.sessionStorage.getItem(STORAGE_PREFIX + key) === '1' } catch { return false }
}

function markPlayed(key: string) {
  playedInMemory.add(key)
  try { window.sessionStorage.setItem(STORAGE_PREFIX + key, '1') } catch { /* bộ nhớ bị chặn: vẫn còn bản trong RAM */ }
}

/** Không có matchMedia (jsdom, trình duyệt cũ) hoặc người dùng giảm chuyển động ⇒ không chạy hiệu ứng. */
function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const shouldStart = (key: string | null): key is string => key !== null && motionAllowed() && !wasPlayed(key)

function useRevealPlayback(key: string | null, durationMs: number) {
  // Quyết định ngay khi render (không đợi effect): tránh loé nội dung thật một khung hình, và để
  // reveal lồng bên trong không kịp mount/đánh dấu "đã phát" trước khi bị sân khấu ngoài che.
  const [playing, setPlaying] = useState<string | null>(() => (shouldStart(key) ? key : null))
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setPlaying(shouldStart(key) ? key : null)
  }
  useEffect(() => {
    if (!key || playing !== key) return
    markPlayed(key)
    // StrictMode chạy effect hai lần: lần hai chỉ gài lại hẹn giờ cho cùng khoá.
    const timer = window.setTimeout(() => setPlaying(current => (current === key ? null : current)), durationMs)
    return () => window.clearTimeout(timer)
  }, [key, playing, durationMs])
  return { playing: playing !== null && playing === key, stop: () => setPlaying(null) }
}

const SIDE = {
  a: { label: 'Đội Xanh', tone: 'text-team-blue-fg', column: 'reveal-column-blue' },
  b: { label: 'Đội Đỏ', tone: 'text-team-red-fg', column: 'reveal-column-red' },
} as const

type VarStyle = CSSProperties & Record<`--${string}`, string | number>

function SlotNumber({ slot }: { slot: number }) {
  return <span className="reveal-slot-no grid size-8 shrink-0 place-items-center rounded-full border border-line-strong text-sm font-bold tabular">{slot}</span>
}

function RouletteSlot({ entry }: { entry: PlannedEntry }) {
  const style: VarStyle = { '--i': entry.order, '--steps': entry.reel.length - 1 }
  return (
    <li className="reveal-roulette-slot flex min-w-0 items-center gap-3 rounded-btn border border-line bg-surface px-3 py-2" style={style}>
      <SlotNumber slot={entry.slot} />
      <span className="min-w-0 flex-1">
        <span className="reveal-reel block h-8 overflow-hidden">
          <span className="reveal-strip flex flex-col">
            {entry.reel.map((label, index) => (
              <span key={index} className={cn('block h-8 truncate text-lg font-bold leading-8', index === entry.reel.length - 1 ? 'reveal-final text-fg' : 'text-fg-subtle')}>{label}</span>
            ))}
          </span>
        </span>
        {entry.secondary && <span className="reveal-caption block break-words text-xs text-fg-muted">{entry.secondary}</span>}
      </span>
    </li>
  )
}

function MeteorSlot({ entry }: { entry: PlannedEntry }) {
  const style: VarStyle = { '--i': entry.order }
  return (
    <li className="reveal-meteor-slot relative min-w-0" style={style}>
      <span className="reveal-meteor-body relative flex min-w-0 items-center gap-3 rounded-btn border border-line bg-surface px-3 py-2">
        <SlotNumber slot={entry.slot} />
        <span className="min-w-0 flex-1 break-words text-lg font-bold">{entry.primary}</span>
        {entry.secondary && <span className="reveal-badge shrink-0 rounded-full bg-gold-tint px-2 py-1 text-xs font-semibold text-gold">{entry.secondary}</span>}
      </span>
      <span className="reveal-meteor-shock" aria-hidden />
    </li>
  )
}

export function TeamReveal({
  entries,
  revealKey,
  variant,
  title,
  pool,
  children,
}: {
  entries: readonly RevealEntry[]
  /** null ⇒ chưa đủ dữ liệu authoritative để công bố. */
  revealKey: string | null
  variant: RevealVariant
  title: string
  /** Bể chữ "mồi" cho reel roulette (vd. danh mục tướng). Mặc định là tên trong `entries`. */
  pool?: readonly string[]
  children: ReactNode
}) {
  const plan = useMemo(() => planReveal(entries, variant, pool), [entries, variant, pool])
  const duration = revealDuration(variant, plan.length)
  const { playing, stop } = useRevealPlayback(revealKey, duration)
  const [announced, setAnnounced] = useState(false)
  const region = useRef<HTMLDivElement>(null)

  useEffect(() => { if (playing) setAnnounced(true) }, [playing])

  const skip = () => {
    stop()
    // Nút Bỏ qua biến mất cùng sân khấu: chuyển focus về vùng nội dung để không rơi về <body>.
    requestAnimationFrame(() => region.current?.focus())
  }

  const timing = REVEAL_TIMING[variant]
  const stageStyle: VarStyle = {
    '--reveal-stagger': `${timing.stagger}ms`,
    '--reveal-duration': `${timing.duration}ms`,
    '--reveal-total': `${duration - timing.settle}ms`,
  }

  return (
    <div ref={region} tabIndex={-1} className="min-w-0 outline-none">
      <p className="sr-only" role="status" aria-live="polite">
        {playing ? `Đang công bố: ${title}.` : announced ? `Đã công bố: ${title}.` : ''}
      </p>
      {playing ? (
        <section
          aria-label={`Công bố ${title}`}
          data-reveal={variant}
          className={cn('reveal-stage relative min-w-0 overflow-hidden rounded-card border border-line bg-surface-2 p-4', `reveal-stage-${variant}`)}
          style={stageStyle}
        >
          <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold">{variant === 'roulette' ? 'Vòng quay ngẫu nhiên' : 'Thiên thạch Tier/Rank'}</p>
              <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            <Button variant="ghost" size="sm" leftIcon={<FastForward size={14} aria-hidden />} onClick={skip}>
              Bỏ qua hiệu ứng
            </Button>
          </div>
          <div className="grid min-w-0 items-center gap-4 md:grid-cols-[1fr_auto_1fr]" aria-hidden>
            {(['a', 'b'] as const).map(side => {
              const column = (
                <div key={side} className={cn('reveal-column min-w-0 rounded-btn border border-line p-3', SIDE[side].column)}>
                  <p className={cn('mb-3 text-sm font-bold uppercase tracking-wide', SIDE[side].tone)}>{SIDE[side].label}</p>
                  <ul className="flex min-w-0 flex-col gap-2">
                    {plan.filter(entry => entry.team === side).sort((x, y) => x.slot - y.slot).map(entry => (
                      variant === 'roulette' ? <RouletteSlot key={entry.id} entry={entry} /> : <MeteorSlot key={entry.id} entry={entry} />
                    ))}
                  </ul>
                </div>
              )
              return side === 'a'
                ? [column, <span key="vs" className="reveal-vs grid size-12 place-items-center justify-self-center rounded-full border border-gold/60 bg-gold-tint text-base font-bold italic text-gold">VS</span>]
                : column
            })}
          </div>
        </section>
      ) : <div className={cn('min-w-0', announced && 'reveal-handoff')}>{children}</div>}
    </div>
  )
}
