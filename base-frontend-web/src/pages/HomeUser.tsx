import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Box,
  ChevronRight,
  Clock3,
  DoorOpen,
  Gamepad2,
  LogIn,
  Plus,
  Trophy,
  UsersRound,
  Zap,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { isRoomMember } from '../lib/room'
import { useMockStatus } from '../lib/mockStatus'
import { ListStatus, SkeletonRows } from '../components/ui/ListStatus'
import { useToast } from '../context/AppContext'
import { activities, currentUser, featuredTournament, roomFullTitle, rooms, type ActivityKind } from '../mocks'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, SectionTitle, SeeAllLink } from '../components/ui/primitives'
import { PageHeader } from '../components/layout/PageHeader'
import { ActiveRoomsCard, RoomStatusBadge } from '../components/domain/RoomsTable'
import { TournamentPromoCard } from '../components/domain/TournamentPromoCard'

const ACTIVITY_ICON: Record<ActivityKind, typeof Gamepad2> = {
  join: Gamepad2,
  register: Trophy,
  invite: UsersRound,
  result: BarChart3,
}

const QUICK_TOOLS: Array<{ icon: ReactNode; title: string; description: string; to: string }> = [
  {
    icon: <UsersRound size={20} />,
    title: 'Chia đội công bằng',
    description: 'Cân bằng trình độ, tự động chia đội',
    to: '/rooms/AOV-1024',
  },
  {
    icon: <Box size={20} />,
    title: 'Random lane / tướng',
    description: 'Phân vị trí hoặc tướng ngẫu nhiên',
    to: '/rooms/AOV-1024',
  },
  { icon: <BarChart3 size={20} />, title: 'Thống kê & hồ sơ', description: 'Lịch sử trận, thành tích, chỉ số', to: '/profile' },
  { icon: <Trophy size={20} />, title: 'Tổ chức giải đấu', description: 'Tạo và quản lý giải đấu mini', to: '/tournaments' },
]

/**
 * Dashboard. Thứ tự: PageHeader → danh sách phòng (nội dung chính) → cột phụ.
 * Nút vàng đặc duy nhất của màn: "Đăng ký ngay" ở promo giải (hành động có hạn chót).
 * "Tạo phòng" đã có ở TopNav (viền vàng) / BottomNav nên không lặp lại ở PageHeader.
 */
export default function HomeUser() {
  const navigate = useNavigate()
  const { comingSoon } = useToast()
  const load = useMockStatus()
  const myRooms = rooms.filter((r) => isRoomMember(r, currentUser.id))

  return (
    <>
      <PageHeader
        title={
          <>
            Xin chào, <span className="text-gold-gradient">{currentUser.name}</span>
          </>
        }
        description="Tạo phòng, lập đội và theo dõi các giải đấu cộng đồng Custom Liên Quân."
        actions={
          <Button variant="ghost" leftIcon={<BookOpen size={18} aria-hidden />} onClick={() => comingSoon('Xem hướng dẫn')}>
            Xem hướng dẫn
          </Button>
        }
      />

      {/*
        < 1024: 1 cột theo thứ tự DOM — phòng → cột phụ → hoạt động gần đây.
        ≥ 1024: cột chính = phòng + hoạt động gần đây (hàng 1, 2); cột phụ chiếm cả 2 hàng.
      */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr] lg:items-start xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Cột chính: danh sách phòng */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ActiveRoomsCard
            id="rooms"
            rooms={rooms}
            userId={currentUser.id}
            onJoin={(r) => navigate(`/rooms/${r.id}`)}
            onWatch={(r) => navigate(`/rooms/${r.id}`)}
            onMore={(r) => comingSoon(`Tùy chọn phòng #${r.id}`)}
            onSeeAll={() => comingSoon('Danh sách tất cả phòng')}
            onCreate={() => navigate('/rooms/new')}
          />
        </div>

        {/* Cột phụ */}
        <aside
          className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
          aria-label="Thông tin của bạn"
        >
          <Card className="p-4">
            <SectionTitle size="sm" icon={<DoorOpen size={20} />} title="Phòng bạn đang tham gia" />
            <ListStatus status={load.status} onRetry={load.retry} label="phòng của bạn" className="mt-3" skeleton={<SkeletonRows count={1} />}>
            {myRooms.length === 0 ? (
              <div className="mt-3 flex flex-col items-start gap-3">
                <p className="text-sm text-fg-muted">Bạn chưa ở trong phòng nào.</p>
                <ButtonLink to="/rooms/new" variant="outline" size="sm" leftIcon={<Plus size={16} aria-hidden />}>
                  Tạo phòng
                </ButtonLink>
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {myRooms.map((r) => (
                  <li key={r.id} className="rounded-btn border border-line bg-surface-2/60 p-3">
                    <div className="flex items-start gap-3">
                      <img src={r.thumbnail} alt="" className="size-10 shrink-0 rounded-btn object-cover ring-1 ring-white/10" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{roomFullTitle(r)}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                          <span className="tabular">#{r.id}</span>
                          <span className="tabular">
                            {r.playerCount}/{r.capacity} người
                          </span>
                          <RoomStatusBadge status={r.status} />
                        </p>
                      </div>
                    </div>
                    <ButtonLink
                      to={`/rooms/${r.id}`}
                      variant="gold-outline"
                      size="sm"
                      className="mt-3 w-full"
                      leftIcon={<LogIn size={16} aria-hidden />}
                    >
                      Vào phòng
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            )}
            </ListStatus>
          </Card>

          <TournamentPromoCard
            tournament={featuredTournament}
            onOpen={() => navigate(`/tournaments/${featuredTournament.slug}`)}
            onRegister={() => comingSoon(`Đăng ký giải ${featuredTournament.name}`)}
          />

          <Card className="p-4">
            <SectionTitle size="sm" icon={<Zap size={20} />} title="Công cụ nhanh" />
            <ul className="mt-2 flex flex-col">
              {QUICK_TOOLS.map((t, i) => (
                <li key={t.title} className={cn(i > 0 && 'border-t border-line')}>
                  <Link
                    to={t.to}
                    className="group flex items-center gap-3 rounded-btn px-2 py-3 transition-colors hover:bg-white/[0.03]"
                  >
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-btn bg-gold-tint text-gold">
                      {t.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-fg">{t.title}</span>
                      <span className="block text-xs text-fg-muted">{t.description}</span>
                    </span>
                    <ChevronRight
                      size={16}
                      aria-hidden
                      className="shrink-0 text-fg-muted transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-gold"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </aside>

        {/* Hoạt động gần đây: ≥ 1024 nằm ở cột chính, dưới bảng phòng; < 1024 nằm cuối trang */}
        <Card className="min-w-0 p-4 lg:col-start-1 lg:row-start-2">
          <SectionTitle
            size="sm"
            icon={<Clock3 size={20} />}
            title="Hoạt động gần đây"
            action={<SeeAllLink onClick={() => comingSoon('Lịch sử hoạt động')} />}
          />
          <ListStatus status={load.status} onRetry={load.retry} label="hoạt động gần đây" className="mt-2" skeleton={<SkeletonRows count={4} />}>
          {activities.length === 0 ? (
            <p className="mt-2 rounded-btn bg-surface-2/60 px-3 py-6 text-center text-sm text-fg-muted">
              Chưa có hoạt động nào. Tham gia một phòng hoặc theo dõi giải đấu để bắt đầu.
            </p>
          ) : (
          <ul className="mt-2">
            {activities.map((a, i) => {
              const Icon = ACTIVITY_ICON[a.kind]
              return (
                <li key={a.id} className={cn('flex items-start gap-3 py-3 text-sm', i > 0 && 'border-t border-line')}>
                  <Icon size={16} aria-hidden className="mt-0.5 shrink-0 text-fg-muted" />
                  {/* Cột chính đủ rộng (≥ 640): thời gian dạt phải cùng dòng */}
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
          )}
          </ListStatus>
        </Card>
      </div>
    </>
  )
}
