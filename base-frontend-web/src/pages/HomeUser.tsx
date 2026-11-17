import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Box,
  ChevronRight,
  Clock3,
  DoorOpen,
  LogIn,
  Plus,
  Trophy,
  UsersRound,
  Zap,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { isRoomMember } from '../lib/room'
import { ListStatus, SkeletonRows } from '../components/ui/ListStatus'
import { useAuth, useToast } from '../context/AppContext'
import {
  ApiError,
  roomsAdapter,
  currentUser,
  joinRoom,
  roomFullTitle,
  useActivities,
  useRooms,
  useTournaments,
  type Room,
} from '../api'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, SectionTitle, SeeAllLink } from '../components/ui/primitives'
import { PageHeader } from '../components/layout/PageHeader'
import { ActiveRoomsCard, RemoteActiveRoomsCard, RoomStatusBadge } from '../components/domain/RoomsTable'
import { TournamentPromoCard } from '../components/domain/TournamentPromoCard'
import { ActivityList } from './Activities'

/** "Hoạt động gần đây": 5 mục mới nhất; xem đủ ở /activities */
const RECENT_ACTIVITIES = { page: 1, pageSize: 5 }

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
  const { comingSoon, notify } = useToast()
  const { user } = useAuth()
  const isApi = roomsAdapter.persistsWrites
  const userId = isApi ? user?.username : currentUser.id
  const displayName = isApi ? (user?.displayName ?? '') : currentUser.name
  // Chế độ api: bảng phòng tự gọi `GET /api/rooms` (phân trang ở server); ở đây chỉ cần "phòng của bạn" (`mine=1`)
  const roomLoad = useRooms(isApi ? { mine: true } : {})
  const activityLoad = useActivities(RECENT_ACTIVITIES)
  const tournamentLoad = useTournaments(isApi ? { status: 'open', sort: 'deadline', pageSize: 1 } : {})
  const rooms = roomLoad.data
  const activities = activityLoad.data.items
  const featuredTournament = tournamentLoad.data[0]
  const myRooms = isApi ? rooms : rooms.filter((r) => isRoomMember(r, currentUser.id))
  /** Mã phòng đang gửi `POST /join` */
  const [joiningId, setJoiningId] = useState<string>()

  const openRoom = (r: Room) => navigate(`/rooms/${r.id}`)
  /**
   * "Vào phòng": chế độ api gọi `POST /api/rooms/:code/join` rồi mới điều hướng (đã là thành viên thì vào thẳng).
   * Lỗi (409 phòng đầy / đang là người chơi ở phòng khác — thông báo của server có mã phòng hiện tại) → toast.
   */
  const join = async (r: Room) => {
    if (!isApi || r.isMember) return openRoom(r)
    if (joiningId) return
    setJoiningId(r.id)
    try {
      const { code } = await joinRoom(r.id)
      navigate(`/rooms/${code}`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Không kết nối được máy chủ. Thử lại sau.'
      notify(`Không vào được phòng #${r.id}`, message)
    } finally {
      setJoiningId(undefined)
    }
  }
  const roomsCardProps = {
    id: 'rooms',
    userId,
    pendingId: joiningId,
    onJoin: join,
    onWatch: openRoom,
    onMore: (r: Room) => comingSoon(`Tùy chọn phòng #${r.id}`),
    onSeeAll: () => comingSoon('Danh sách tất cả phòng'),
    onCreate: () => navigate('/rooms/new'),
  }

  return (
    <>
      <PageHeader
        title={
          <>
            Xin chào, <span className="text-gold-gradient">{displayName}</span>
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
          {isApi ? (
            <RemoteActiveRoomsCard {...roomsCardProps} />
          ) : (
            <ActiveRoomsCard {...roomsCardProps} rooms={rooms} status={roomLoad.status} onRetry={roomLoad.retry} />
          )}
        </div>

        {/* Cột phụ */}
        <aside
          className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
          aria-label="Thông tin của bạn"
        >
          <Card className="p-4">
            <SectionTitle size="sm" icon={<DoorOpen size={20} />} title="Phòng bạn đang tham gia" />
            <ListStatus status={roomLoad.status} onRetry={roomLoad.retry} label="phòng của bạn" className="mt-3" skeleton={<SkeletonRows count={1} />}>
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

          {tournamentLoad.status !== 'ready' ? (
            <Card className="p-4">
              <SectionTitle className="px-1" size="md" icon={<Trophy size={22} />} title="Giải đấu cộng đồng nổi bật" />
              <ListStatus
                status={tournamentLoad.status}
                onRetry={tournamentLoad.retry}
                label="giải đấu nổi bật"
                className="mt-3"
                skeleton={<SkeletonRows count={2} />}
              >
                {null}
              </ListStatus>
            </Card>
          ) : (
            featuredTournament && (
              <TournamentPromoCard
                tournament={featuredTournament}
                onOpen={() => navigate(`/tournaments/${featuredTournament.slug}`)}
                onRegister={() =>
                  isApi ? navigate(`/tournaments/${featuredTournament.slug}`) : comingSoon(`Đăng ký giải ${featuredTournament.name}`)
                }
              />
            )
          )}

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
            action={<SeeAllLink to="/activities" />}
          />
          <ListStatus status={activityLoad.status} onRetry={activityLoad.retry} label="hoạt động gần đây" className="mt-2" skeleton={<SkeletonRows count={4} />}>
          {activities.length === 0 ? (
            <p className="mt-2 rounded-btn bg-surface-2/60 px-3 py-6 text-center text-sm text-fg-muted">
              Chưa có hoạt động nào. Tham gia một phòng hoặc theo dõi giải đấu để bắt đầu.
            </p>
          ) : (
            <ActivityList items={activities} className="mt-2" />
          )}
          </ListStatus>
        </Card>
      </div>
    </>
  )
}
