import { useMemo, useState } from 'react'
import { Eye, Gamepad2, LogIn, MoreHorizontal, SearchX, UserRound } from 'lucide-react'
import { cn } from '../../lib/cn'
import { isRoomMember, roomAction, roomMode } from '../../lib/room'
import { roomFullTitle, type Room } from '../../mocks'
import { Button, IconButton } from '../ui/Button'
import { Avatar, Badge, Card, Chip, CrownMark, SectionTitle, SeeAllLink } from '../ui/primitives'
import { FilterChips } from '../ui/FilterChips'
import { ListStatus, SkeletonRows } from '../ui/ListStatus'
import { useMockStatus } from '../../lib/mockStatus'
import { EmptyState } from './EmptyState'

export function RoomStatusBadge({ status }: { status: Room['status'] }) {
  return status === 'live' ? <Badge tone="live">Đang diễn ra</Badge> : <Badge tone="waiting">Đang chờ</Badge>
}

interface RoomHandlers {
  onJoin: (room: Room) => void
  onWatch: (room: Room) => void
}

/** Nút hành động theo `roomAction`. Không dùng vàng đặc: nút vàng đặc dành cho hành động chính của màn. */
export function RoomActionButton({
  room,
  userId,
  onJoin,
  onWatch,
  className,
}: RoomHandlers & { room: Room; userId?: string; className?: string }) {
  const action = roomAction(room, userId)
  if (action === 'join')
    return (
      <Button
        size="sm"
        variant="gold-outline"
        className={className}
        leftIcon={<LogIn size={16} aria-hidden />}
        onClick={() => onJoin(room)}
        aria-label={`Vào phòng ${roomFullTitle(room)}`}
      >
        Vào phòng
      </Button>
    )
  return (
    <Button
      size="sm"
      variant="secondary"
      className={className}
      leftIcon={<Eye size={16} aria-hidden />}
      onClick={() => onWatch(room)}
      aria-label={`${action === 'watch' ? 'Theo dõi' : 'Xem'} phòng ${roomFullTitle(room)}`}
    >
      {action === 'watch' ? 'Theo dõi' : 'Xem'}
    </Button>
  )
}

/** "6 / 10" + nhãn "Đủ người" khi phòng chờ đã đầy */
function PlayerCount({ room }: { room: Room }) {
  const full = room.playerCount >= room.capacity
  return (
    <span className="inline-flex flex-wrap items-center gap-2 whitespace-nowrap text-sm">
      <span className={cn('inline-flex items-center gap-2 tabular', full && 'text-fg-muted')}>
        <UserRound size={16} aria-hidden className="text-fg-muted" />
        <span>
          {room.playerCount} / {room.capacity}
          <span className="sr-only"> người chơi</span>
        </span>
      </span>
      {full && room.status === 'waiting' && <Badge tone="neutral">Đủ người</Badge>}
    </span>
  )
}

/** Dòng phụ dưới tên phòng: #mã · chủ phòng · chế độ */
function RoomMeta({ room, userId }: { room: Room; userId?: string }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
      <span className="tabular">#{room.id}</span>
      <span className="inline-flex items-center gap-2">
        <Avatar src={room.host.avatar} name={room.host.name} alt="" size={20} />
        <span className="text-fg">{room.host.name}</span>
        {room.host.crowned && <CrownMark size={14} />}
      </span>
      <Chip>{room.modeLabel}</Chip>
      {isRoomMember(room, userId) && <Badge tone="gold-outline">Phòng của bạn</Badge>}
    </div>
  )
}

/**
 * Card phòng dạng dọc — dùng cho danh sách phòng trên mobile (dashboard) và 3 phòng nổi bật ở landing.
 */
export function RoomCard({
  room,
  userId,
  onJoin,
  onWatch,
  className,
  as: Tag = 'li',
}: RoomHandlers & { room: Room; userId?: string; className?: string; as?: 'li' | 'div' }) {
  return (
    <Tag
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface-2/60 p-3',
        roomAction(room, userId) === 'view' && 'bg-surface/60',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <img src={room.thumbnail} alt="" className="size-12 shrink-0 rounded-btn object-cover ring-1 ring-white/10" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">{roomFullTitle(room)}</p>
          <RoomMeta room={room} userId={userId} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PlayerCount room={room} />
          <RoomStatusBadge status={room.status} />
        </div>
        <RoomActionButton room={room} userId={userId} onJoin={onJoin} onWatch={onWatch} className="min-w-28" />
      </div>
    </Tag>
  )
}

type ModeFilter = 'all' | 'Căng' | 'Vui' | 'Custom'
const MODE_FILTERS: Array<{ id: ModeFilter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Căng', label: 'Căng' },
  { id: 'Vui', label: 'Vui' },
  { id: 'Custom', label: 'Custom' },
]

/**
 * Khối "Phòng custom đang hoạt động" (dashboard).
 * - ≥ 768px: bảng 4 cột (Phòng · Người chơi · Trạng thái · Thao tác); chủ phòng + chế độ nằm ở dòng phụ
 *   dưới tên phòng nên bảng vừa với cột trái mà không cần cuộn ngang.
 * - < 768px: danh sách card.
 * - Bộ lọc chế độ (Căng / Vui / Custom) + empty state.
 */
export function ActiveRoomsCard({
  rooms,
  userId,
  onJoin,
  onWatch,
  onMore,
  onSeeAll,
  onCreate,
  className,
  id,
}: RoomHandlers & {
  /** id cho anchor (vd. #rooms ở BottomNav / TopNav) */
  id?: string
  rooms: Room[]
  /** Người dùng hiện tại — để nhận biết "Phòng của bạn" */
  userId?: string
  onMore: (room: Room) => void
  onSeeAll: () => void
  /** Hành động trong empty state */
  onCreate?: () => void
  className?: string
}) {
  const [mode, setMode] = useState<ModeFilter>('all')
  const load = useMockStatus()
  const counts = useMemo(() => {
    const c: Record<ModeFilter, number> = { all: rooms.length, Căng: 0, Vui: 0, Custom: 0 }
    for (const r of rooms) {
      const m = roomMode(r) as ModeFilter
      if (m in c) c[m]++
    }
    return c
  }, [rooms])
  const list = mode === 'all' ? rooms : rooms.filter((r) => roomMode(r) === mode)
  const th = 'h-9 px-3 whitespace-nowrap text-left text-sm font-normal text-fg-muted first:rounded-l-btn last:rounded-r-btn'

  return (
    <Card id={id} className={cn('p-4', className)}>
      <SectionTitle
        size="lg"
        icon={<Gamepad2 size={24} className="fill-gold/15" />}
        title="Phòng custom đang hoạt động"
        action={<SeeAllLink onClick={onSeeAll}>Xem tất cả</SeeAllLink>}
      />
      <FilterChips
        className="mt-3"
        label="Lọc phòng theo chế độ"
        options={MODE_FILTERS.map((f) => ({ ...f, count: counts[f.id] }))}
        value={mode}
        onChange={setMode}
      />

      <ListStatus
        status={load.status}
        onRetry={load.retry}
        label="danh sách phòng"
        className="mt-4"
        skeleton={<SkeletonRows count={5} />}
      >
      {list.length === 0 ? (
        <EmptyState
          className="mt-4 py-10"
          icon={<SearchX size={28} />}
          title={`Chưa có phòng “${mode}” nào đang mở`}
          description="Thử chế độ khác, hoặc tự tạo một phòng để mời bạn bè."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setMode('all')}>
                Xem tất cả phòng
              </Button>
              {onCreate && (
                <Button variant="gold-outline" onClick={onCreate}>
                  Tạo phòng
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          {/* Mobile: card list */}
          <ul className="mt-3 flex flex-col gap-3 md:hidden">
            {list.map((room) => (
              <RoomCard key={room.id} room={room} userId={userId} onJoin={onJoin} onWatch={onWatch} />
            ))}
          </ul>

          {/* ≥ 768px: bảng */}
          <div className="hidden md:block">
            <div className="relative mt-3 overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <caption className="sr-only">Danh sách phòng custom đang hoạt động</caption>
                <thead>
                  <tr className="bg-surface-3/80">
                    <th scope="col" className={cn(th, 'pl-4')}>
                      Phòng
                    </th>
                    <th scope="col" className={th}>
                      Người chơi
                    </th>
                    <th scope="col" className={th}>
                      Trạng thái
                    </th>
                    <th scope="col" className={cn(th, 'text-right')}>
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((room, i) => {
                    const td = cn('px-3 py-3', i > 0 && 'border-t border-line')
                    return (
                      <tr
                        key={room.id}
                        className={cn(
                          'transition-colors hover:bg-white/[0.025]',
                          roomAction(room, userId) === 'view' && 'text-fg-muted',
                        )}
                      >
                        <td className={cn(td, 'pl-4')}>
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src={room.thumbnail}
                              alt=""
                              className="size-10 shrink-0 rounded-btn object-cover ring-1 ring-white/10"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-fg">{roomFullTitle(room)}</p>
                              <RoomMeta room={room} userId={userId} />
                            </div>
                          </div>
                        </td>
                        <td className={td}>
                          <PlayerCount room={room} />
                        </td>
                        <td className={td}>
                          <RoomStatusBadge status={room.status} />
                        </td>
                        <td className={td}>
                          <div className="flex items-center justify-end gap-2">
                            <RoomActionButton
                              room={room}
                              userId={userId}
                              onJoin={onJoin}
                              onWatch={onWatch}
                              className="min-w-28"
                            />
                            <IconButton
                              label={`Tùy chọn phòng ${room.id}`}
                              variant="ghost"
                              className="size-8"
                              onClick={() => onMore(room)}
                            >
                              <MoreHorizontal size={18} aria-hidden />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      </ListStatus>
    </Card>
  )
}
