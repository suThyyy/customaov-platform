import { useEffect, useMemo, useState } from 'react'
import type { RoomMode } from '@customaov/contracts'
import { Eye, Gamepad2, LogIn, MoreHorizontal, Search, SearchX, UserRound, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { isRoomMember, roomAction, roomMode, type RoomAction } from '../../lib/room'
import { roomFullTitle, roomsAdapter, useRoomsPage, type LoadStatus, type Room } from '../../api'
import { Button, IconButton } from '../ui/Button'
import { Avatar, Badge, Card, Chip, CrownMark, SectionTitle, SeeAllLink } from '../ui/primitives'
import { FilterChips } from '../ui/FilterChips'
import { ListStatus, SkeletonRows } from '../ui/ListStatus'
import { Pagination } from '../ui/Pagination'
import { EmptyState } from './EmptyState'
import { SampleDataBadge } from '../ui/SampleDataBadge'

/**
 * Thành viên phòng: chế độ api dùng `isMember` của server (danh sách không kèm đội);
 * chế độ mock suy ra từ `teams` như trước.
 */
const isMember = (room: Room, userId?: string): boolean => room.isMember ?? isRoomMember(room, userId)

/** Như `roomAction`, nhưng nhận biết thành viên qua `isMember` */
const actionOf = (room: Room, userId?: string): RoomAction => {
  if (room.status === 'finished') return 'view'
  return isMember(room, userId) ? 'join' : roomAction(room)
}

export function RoomStatusBadge({ status }: { status: Room['status'] }) {
  if (status === 'live') return <Badge tone="live">Đang diễn ra</Badge>
  if (status === 'finished') return <Badge tone="neutral">Đã kết thúc</Badge>
  return <Badge tone="waiting">Đang chờ</Badge>
}

interface RoomHandlers {
  onJoin: (room: Room) => void
  onWatch: (room: Room) => void
  /** Mã phòng đang gửi yêu cầu vào phòng: nút tương ứng bị khoá, hiện "Đang vào…" */
  pendingId?: string
}

/** Nút hành động theo `roomAction`. Không dùng vàng đặc: nút vàng đặc dành cho hành động chính của màn. */
export function RoomActionButton({
  room,
  userId,
  onJoin,
  onWatch,
  pendingId,
  className,
}: RoomHandlers & { room: Room; userId?: string; className?: string }) {
  const action = actionOf(room, userId)
  if (action === 'join') {
    const pending = pendingId === room.id
    return (
      <Button
        size="sm"
        variant="gold-outline"
        className={className}
        leftIcon={<LogIn size={16} aria-hidden />}
        onClick={() => onJoin(room)}
        disabled={pendingId !== undefined}
        aria-busy={pending || undefined}
        aria-label={`Vào phòng ${roomFullTitle(room)}`}
      >
        {pending ? 'Đang vào…' : 'Vào phòng'}
      </Button>
    )
  }
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
      {isMember(room, userId) && <Badge tone="gold-outline">Phòng của bạn</Badge>}
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
  pendingId,
  className,
  as: Tag = 'li',
}: RoomHandlers & { room: Room; userId?: string; className?: string; as?: 'li' | 'div' }) {
  return (
    <Tag
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface-2/60 p-3',
        actionOf(room, userId) === 'view' && 'bg-surface/60',
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
        <RoomActionButton
          room={room}
          userId={userId}
          onJoin={onJoin}
          onWatch={onWatch}
          pendingId={pendingId}
          className="min-w-28"
        />
      </div>
    </Tag>
  )
}

type ModeFilter = 'all' | 'Fun' | 'Tryhard'
const MODE_FILTERS: Array<{ id: ModeFilter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Fun', label: 'Fun' },
  { id: 'Tryhard', label: 'Tryhard' },
]

/** Chip phong cách → `RoomMode` mà wizard mới gửi lên API. */
const MODE_FILTER_API: Record<Exclude<ModeFilter, 'all'>, RoomMode> = {
  Fun: 'friendly',
  Tryhard: 'normal',
}

/** Số phòng mỗi trang của danh sách phân trang ở server */
const ROOMS_PAGE_SIZE = 10

/** Điều khiển lọc/tìm/phân trang khi danh sách được lọc ở server (chế độ api) */
interface ServerListControls {
  mode: ModeFilter
  onModeChange: (mode: ModeFilter) => void
  query: string
  onQueryChange: (query: string) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Tổng số phòng khớp bộ lọc (server trả về) */
  total: number
}

type ActiveRoomsCardProps = RoomHandlers & {
  /** id cho anchor (vd. #rooms ở BottomNav / TopNav) */
  id?: string
  /** Người dùng hiện tại — để nhận biết "Phòng của bạn" */
  userId?: string
  onMore: (room: Room) => void
  onSeeAll: () => void
  /** Hành động trong empty state */
  onCreate?: () => void
  className?: string
}

/**
 * Khối "Phòng custom đang hoạt động" (dashboard).
 * - ≥ 768px: bảng 4 cột (Phòng · Người chơi · Trạng thái · Thao tác); chủ phòng + chế độ nằm ở dòng phụ
 *   dưới tên phòng nên bảng vừa với cột trái mà không cần cuộn ngang.
 * - < 768px: danh sách card.
 * - Bộ lọc phong cách (Fun / Tryhard) + empty state.
 * - Không có `server`: lọc chế độ tại chỗ trên `rooms` (chế độ mock).
 *   Có `server`: `rooms` là một trang đã lọc ở server; thêm ô tìm kiếm + phân trang (`RemoteActiveRoomsCard`).
 */
export function ActiveRoomsCard({
  rooms,
  userId,
  onJoin,
  onWatch,
  pendingId,
  onMore,
  onSeeAll,
  onCreate,
  className,
  id,
  status = 'ready',
  onRetry = () => undefined,
  server,
}: ActiveRoomsCardProps & {
  rooms: Room[]
  status?: LoadStatus
  onRetry?: () => void
  server?: ServerListControls
}) {
  const [localMode, setLocalMode] = useState<ModeFilter>('all')
  const mode = server ? server.mode : localMode
  const setMode = server ? server.onModeChange : setLocalMode
  const counts = useMemo(() => {
    const c: Record<ModeFilter, number> = { all: rooms.length, Fun: 0, Tryhard: 0 }
    for (const r of rooms) {
      const m = roomMode(r) as ModeFilter
      if (m in c) c[m]++
    }
    return c
  }, [rooms])
  const list = server || mode === 'all' ? rooms : rooms.filter((r) => roomMode(r) === mode)
  const query = server?.query.trim() ?? ''
  const th = 'h-9 px-3 whitespace-nowrap text-left text-sm font-normal text-fg-muted first:rounded-l-btn last:rounded-r-btn'

  return (
    <Card id={id} className={cn('p-4', className)}>
      <SectionTitle
        size="lg"
        icon={<Gamepad2 size={24} className="fill-gold/15" />}
        title="Phòng custom đang hoạt động"
        action={<span className="flex items-center gap-2"><SampleDataBadge show={roomsAdapter.showsSampleBadge} /><SeeAllLink onClick={onSeeAll}>Xem tất cả</SeeAllLink></span>}
      />
      {server && (
        <div role="search" aria-label="Tìm phòng" className="mt-3">
          <label className="relative flex h-10 w-full min-w-0 items-center rounded-btn border border-line-strong bg-surface/80 transition-colors focus-within:border-gold/60 hover:border-white/30">
            <Search size={18} aria-hidden className="pointer-events-none absolute left-4 text-fg-muted" />
            <span className="sr-only">Tìm phòng theo tên, mã phòng hoặc chủ phòng</span>
            <input
              type="search"
              value={server.query}
              onChange={(e) => server.onQueryChange(e.target.value)}
              placeholder="Tìm theo tên phòng, mã phòng, chủ phòng…"
              className="h-full w-full min-w-0 bg-transparent pr-12 pl-12 text-sm text-fg outline-none placeholder:text-fg-subtle [&::-webkit-search-cancel-button]:hidden"
            />
            {server.query && (
              <button
                type="button"
                onClick={() => server.onQueryChange('')}
                aria-label="Xoá từ khoá"
                className="absolute right-1 grid size-8 place-items-center rounded-btn text-fg-muted hover:bg-white/5 hover:text-fg"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </label>
        </div>
      )}
      <FilterChips
        className="mt-3"
        label="Lọc phòng theo chế độ"
        // Chế độ api: server chỉ trả tổng của bộ lọc đang chọn, nên không hiện số trên từng chip
        options={server ? MODE_FILTERS : MODE_FILTERS.map((f) => ({ ...f, count: counts[f.id] }))}
        value={mode}
        onChange={setMode}
      />
      {server && status === 'ready' && (
        <p className="mt-2 text-xs text-fg-muted" aria-live="polite">
          <span className="tabular">{server.total}</span> phòng
        </p>
      )}

      <ListStatus
        status={status}
        onRetry={onRetry}
        label="danh sách phòng"
        className="mt-4"
        skeleton={<SkeletonRows count={5} />}
      >
      {list.length === 0 ? (
        <EmptyState
          className="mt-4 py-10"
          icon={<SearchX size={28} />}
          title={
            query
              ? `Không tìm thấy phòng nào khớp “${query}”`
              : mode === 'all'
                ? 'Chưa có phòng nào đang mở'
                : `Chưa có phòng “${mode}” nào đang mở`
          }
          description={
            query ? 'Thử từ khoá khác hoặc bỏ bộ lọc chế độ.' : 'Thử chế độ khác, hoặc tự tạo một phòng để mời bạn bè.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setMode('all')
                  server?.onQueryChange('')
                }}
              >
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
              <RoomCard
                key={room.id}
                room={room}
                userId={userId}
                onJoin={onJoin}
                onWatch={onWatch}
                pendingId={pendingId}
              />
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
                          actionOf(room, userId) === 'view' && 'text-fg-muted',
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
                              pendingId={pendingId}
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
      {server && status === 'ready' && (
        <Pagination
          className="mt-4"
          label="Phân trang danh sách phòng"
          page={server.page}
          totalPages={server.totalPages}
          onChange={server.onPageChange}
        />
      )}
    </Card>
  )
}

/** Thời gian chờ sau khi ngừng gõ rồi mới gửi `q` lên server */
const SEARCH_DEBOUNCE_MS = 300

/**
 * `ActiveRoomsCard` tự lấy dữ liệu qua `GET /api/rooms` (chế độ api): lọc chế độ, tìm kiếm (`q`)
 * và phân trang (`page`, `pageSize`) đều chạy ở server. Trạng thái tải/lỗi qua `ListStatus`.
 */
export function RemoteActiveRoomsCard(props: ActiveRoomsCardProps) {
  const [mode, setMode] = useState<ModeFilter>('all')
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const next = input.trim()
    if (next === q) return
    const timer = window.setTimeout(() => {
      setQ(next)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [input, q])

  const load = useRoomsPage({
    q: q || undefined,
    mode: mode === 'all' ? undefined : MODE_FILTER_API[mode],
    page,
    pageSize: ROOMS_PAGE_SIZE,
  })
  const totalPages = Math.max(1, Math.ceil(load.data.total / ROOMS_PAGE_SIZE))

  // Danh sách co lại (vd. phòng vừa đóng) khi đang ở trang cuối → lùi về trang cuối còn dữ liệu
  useEffect(() => {
    if (load.status === 'ready' && page > totalPages) setPage(totalPages)
  }, [load.status, page, totalPages])

  return (
    <ActiveRoomsCard
      {...props}
      rooms={load.data.items}
      status={load.status}
      onRetry={load.retry}
      server={{
        mode,
        onModeChange: (next) => {
          setMode(next)
          setPage(1)
        },
        query: input,
        onQueryChange: (next) => {
          setInput(next)
          // Xoá từ khoá: áp dụng ngay, không chờ debounce
          if (!next.trim()) {
            setQ('')
            setPage(1)
          }
        },
        page,
        totalPages,
        onPageChange: setPage,
        total: load.data.total,
      }}
    />
  )
}
