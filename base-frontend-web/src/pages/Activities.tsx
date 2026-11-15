import { useSearchParams } from 'react-router-dom'
import { BarChart3, Clock3, Gamepad2, Trophy, UsersRound } from 'lucide-react'
import { cn } from '../lib/cn'
import { useActivities, type Activity, type ActivityKind } from '../api'
import { ListStatus, SkeletonRows } from '../components/ui/ListStatus'
import { Card } from '../components/ui/primitives'
import { Pagination } from '../components/ui/Pagination'
import { ButtonLink } from '../components/ui/Button'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/domain/EmptyState'

const ACTIVITY_ICON: Record<ActivityKind, typeof Gamepad2> = {
  join: Gamepad2,
  register: Trophy,
  invite: UsersRound,
  result: BarChart3,
}

/** Danh sách hoạt động (dùng chung cho dashboard và /activities). Empty state do nơi gọi tự lo. */
export function ActivityList({ items, className }: { items: Activity[]; className?: string }) {
  return (
    <ul className={className}>
      {items.map((a, i) => {
        const Icon = ACTIVITY_ICON[a.kind]
        return (
          <li key={a.id} className={cn('flex items-start gap-3 py-3 text-sm', i > 0 && 'border-t border-line')}>
            <Icon size={16} aria-hidden className="mt-0.5 shrink-0 text-fg-muted" />
            {/* Đủ rộng (≥ 640): thời gian dạt phải cùng dòng */}
            <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span className="min-w-0">
                {a.text}
                {a.emphasis && (
                  <>
                    {' '}
                    (<span className="font-medium text-gold">{a.emphasis}</span>)
                  </>
                )}
              </span>
              <span className="shrink-0 text-xs whitespace-nowrap text-fg-muted">{a.timeAgo}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const PAGE_SIZE = 10

/** /activities — lịch sử hoạt động đầy đủ của tôi, phân trang theo `?page=`. */
export default function Activities() {
  const [params, setParams] = useSearchParams()
  const pageParam = Number(params.get('page') ?? '1')
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1
  const load = useActivities({ page, pageSize: PAGE_SIZE })
  const { items, total } = load.data
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const goTo = (p: number) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (p <= 1) next.delete('page')
      else next.set('page', String(p))
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lịch sử hoạt động"
        description="Các phòng bạn tham gia, giải bạn đăng ký và kết quả trận đấu liên quan tới bạn."
      />

      <ListStatus
        status={load.status}
        onRetry={load.retry}
        label="lịch sử hoạt động"
        skeleton={
          <Card className="p-4">
            <SkeletonRows count={6} />
          </Card>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={<Clock3 size={28} />}
            title={total === 0 ? 'Chưa có hoạt động nào' : 'Trang này không có hoạt động'}
            description={
              total === 0
                ? 'Tham gia một phòng hoặc đăng ký giải đấu để bắt đầu.'
                : 'Trang bạn mở vượt quá số trang hiện có.'
            }
            action={
              total === 0 ? (
                <ButtonLink to="/dashboard#rooms" variant="outline">
                  Xem phòng đang mở
                </ButtonLink>
              ) : (
                <ButtonLink to="/activities" variant="outline">
                  Về trang đầu
                </ButtonLink>
              )
            }
          />
        ) : (
          <>
            <Card className="px-4 py-1">
              <p className="sr-only">
                Trang {page}/{totalPages}, tổng {total} hoạt động
              </p>
              <ActivityList items={items} />
            </Card>
            <Pagination
              className="mt-6"
              label="Phân trang lịch sử hoạt động"
              page={Math.min(page, totalPages)}
              totalPages={totalPages}
              onChange={goTo}
            />
          </>
        )}
      </ListStatus>
    </div>
  )
}
