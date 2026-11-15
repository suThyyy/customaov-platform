import { useState, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Crown } from 'lucide-react'
import { cn } from '../../lib/cn'

/* ---------------- Card ---------------- */

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface/90 shadow-[var(--shadow-card)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/* ---------------- Section title ---------------- */

export function SectionTitle({
  icon,
  title,
  action,
  className,
  size = 'md',
  as: Tag = 'h2',
}: {
  icon?: ReactNode
  title: ReactNode
  action?: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
  as?: 'h2' | 'h3'
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <Tag
        className={cn(
          'flex min-w-0 items-center gap-3 font-semibold text-fg',
          // lg/md: tiêu đề section (20px); sm: tiêu đề card nhỏ (16px)
          (size === 'lg' || size === 'md') && 'text-lg',
          size === 'sm' && 'text-base',
        )}
      >
        {icon && (
          <span className="text-gold" aria-hidden>
            {icon}
          </span>
        )}
        {title}
      </Tag>
      {action}
    </div>
  )
}

/** Link vàng "Xem tất cả →" ở góc phải tiêu đề */
export function SeeAllLink({
  children = 'Xem tất cả',
  to,
  onClick,
  className,
}: {
  children?: ReactNode
  to?: string
  onClick?: () => void
  className?: string
}) {
  const cls = cn(
    'group inline-flex shrink-0 items-center gap-1.5 rounded-btn text-sm font-semibold whitespace-nowrap text-gold transition-colors hover:text-gold-300',
    className,
  )
  const inner = (
    <>
      {children}
      <ArrowRight size={15} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5" />
    </>
  )
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    )
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

/* ---------------- Eyebrow (CUSTOM AOV COMMUNITY) ---------------- */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center self-start rounded-btn bg-gold-tint/90 px-2 py-1 text-xs font-semibold tracking-[0.06em] text-gold uppercase',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------- Badge ---------------- */

export type BadgeTone = 'waiting' | 'live' | 'success' | 'danger' | 'neutral' | 'gold-solid' | 'gold-outline'

const tones: Record<BadgeTone, string> = {
  waiting: 'bg-warning-bg text-warning',
  live: 'bg-success-bg text-success',
  success: 'bg-success-bg text-success ring-1 ring-success/25',
  danger: 'bg-danger-bg text-danger ring-1 ring-danger/25',
  neutral: 'bg-surface-3 text-fg-muted',
  'gold-solid': 'bg-gold-gradient text-gold-ink',
  'gold-outline': 'text-gold ring-1 ring-gold/70',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
  icon?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** Pill cấp độ "Lv.42" viền vàng */
export function LevelPill({ level, className }: { level: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-btn px-1.5 text-xs leading-[18px] font-semibold text-gold ring-1 ring-gold/80',
        className,
      )}
    >
      Lv.{level}
    </span>
  )
}

/** Chip trung tính (5v5 · Custom) */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-chip bg-surface-3/80 px-2.5 py-1 text-xs whitespace-nowrap text-fg-muted ring-1 ring-white/5',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------- Avatar ---------------- */

/** Bảng màu nền cho avatar chữ cái (đủ tối để chữ trắng đạt tương phản) */
const AVATAR_HUES = [210, 340, 25, 150, 270, 190, 45, 0]

function avatarHue(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_HUES[h % AVATAR_HUES.length]
}

/** Lấy 1–2 chữ cái đầu: "KhoaNeo" → "KN", "Team Xanh" → "TX", "suthy" → "S" */
function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase()
  const caps = name.match(/\p{Lu}/gu)
  if (caps && caps.length >= 2) return caps.slice(0, 2).join('')
  return name.slice(0, 1).toUpperCase()
}

export function Avatar({
  src,
  alt,
  name,
  size = 32,
  rounded = 'full',
  className,
  ring,
}: {
  src?: string
  alt: string
  /** Tên dùng để tạo avatar chữ cái khi không có ảnh hoặc ảnh lỗi */
  name?: string
  size?: number
  rounded?: 'full' | 'lg' | 'xl'
  className?: string
  ring?: boolean
}) {
  // Lưu src đã lỗi (thay vì boolean) để khi src đổi thì tự thử tải lại
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const shape = cn(
    'shrink-0',
    rounded === 'full' && 'rounded-full',
    rounded === 'lg' && 'rounded-btn',
    rounded === 'xl' && 'rounded-card',
    ring && 'ring-2 ring-white/15',
  )

  if (!src || failedSrc === src) {
    const label = name ?? alt
    return (
      <span
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        style={{ width: size, height: size, backgroundColor: `hsl(${avatarHue(label)} 45% 32%)` }}
        className={cn(
          shape,
          'inline-grid place-items-center font-semibold text-white select-none',
          size >= 48 ? 'text-lg' : size >= 32 ? 'text-sm' : 'text-xs',
          className,
        )}
      >
        {initials(label || '?')}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      style={{ width: size, height: size }}
      className={cn(shape, 'bg-surface-3 object-cover', className)}
    />
  )
}

export function CrownMark({ size = 16, className }: { size?: number; className?: string }) {
  return <Crown size={size} aria-label="Chủ phòng" className={cn('fill-gold text-gold', className)} />
}
