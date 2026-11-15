import { ArrowRight, CalendarDays, Trophy } from 'lucide-react'
import { asset } from '../../lib/asset'
import { cn } from '../../lib/cn'
import type { Tournament } from '../../mocks'
import { Button } from '../ui/Button'
import { Card, SectionTitle } from '../ui/primitives'
import { RegistrationProgress } from './RegistrationProgress'

/** Khối "Giải đấu cộng đồng nổi bật" — trang chủ khách (lg) & người dùng (md) */
export function TournamentPromoCard({
  tournament: t,
  size = 'md',
  onRegister,
  onOpen,
  ctaVariant = 'primary',
  className,
}: {
  tournament: Tournament
  size?: 'md' | 'lg'
  /** Kiểu nút "Đăng ký ngay": primary khi đây là hành động chính của màn, gold-outline khi màn đã có nút vàng khác */
  ctaVariant?: 'primary' | 'gold-outline'
  onRegister: () => void
  onOpen: () => void
  className?: string
}) {
  const lg = size === 'lg'
  return (
    <Card className={cn('p-4', className)}>
      <SectionTitle
        className="px-1"
        size={lg ? 'lg' : 'md'}
        icon={<Trophy size={lg ? 26 : 22} />}
        title="Giải đấu cộng đồng nổi bật"
      />
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Xem chi tiết giải ${t.name}`}
        className={cn(
          'group relative mt-3 block w-full overflow-hidden rounded-card text-left ring-1 ring-white/10',
          // min-h thay vì h cố định: chữ trên ảnh được xuống dòng mà không tràn
          lg ? 'min-h-48' : 'min-h-40',
        )}
      >
        <img
          src={asset(lg ? 'card-tournament-lg.jpg' : 'hero-tournament.jpg')}
          alt=""
          className={cn(
            'absolute inset-y-0 right-0 h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
            lg ? 'w-[62%] object-[60%_30%]' : 'w-[70%] object-[52%_25%]',
          )}
        />
        {/* Phase 5: phủ đậm hơn ở vùng chữ (trước 32% đặc / 55% còn 0.55) — chữ phụ 12px đạt AA 4.5:1 (đo điểm ảnh) */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#1f2232_0%,#1f2232_42%,rgb(31_34_50/0.85)_60%,rgb(31_34_50/0.25)_85%,transparent_100%)]" />
        <div className={cn('relative flex h-full flex-col', lg ? 'px-6 py-8' : 'px-4 py-4')}>
          <p className={cn('font-display leading-[1.2] font-bold', lg ? 'text-2xl' : 'text-lg')}>
            Giải Custom
            <br />
            <span className="text-gold-gradient">{t.name.split(' – ')[0]}</span>
          </p>
          <p className={cn('flex items-center gap-2 text-fg', lg ? 'mt-4 text-sm' : 'mt-2 text-xs')}>
            {lg && <CalendarDays size={16} aria-hidden className="text-fg-muted" />}
            {t.format}{t.name.includes(' – ') && ` · ${t.name.split(' – ')[1]}`}
          </p>
          <p className={cn('mt-2 flex items-center gap-2 text-fg', lg ? 'text-sm' : 'text-xs')}>
            <CalendarDays size={lg ? 16 : 15} aria-hidden className="text-fg-muted" />
            {t.registrationDeadline ? `Đăng ký đến ${t.registrationDeadline}` : t.timeLabel}
          </p>
        </div>
      </button>
      {t.registeredTeams !== undefined && (
        <RegistrationProgress registered={t.registeredTeams} total={t.teamCount} className="mt-3 px-1" />
      )}
      <Button
        variant={ctaVariant}
        size={lg ? 'xl' : 'lg'}
        className="relative z-10 mt-3 w-full"
        rightIcon={<ArrowRight size={19} aria-hidden />}
        onClick={onRegister}
      >
        Đăng ký ngay
      </Button>
    </Card>
  )
}
