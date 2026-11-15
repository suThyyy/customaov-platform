import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Crosshair,
  Crown,
  Download,
  Eye,
  Feather,
  Gamepad2,
  Gift,
  Globe,
  GripVertical,
  Lock,
  LogIn,
  MessageSquareText,
  MonitorPlay,
  MoreVertical,
  PawPrint,
  RefreshCw,
  Scale,
  SendHorizontal,
  Share2,
  Shield,
  ShieldPlus,
  Shuffle,
  UserMinus,
  UserPlus,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { asset } from '../lib/asset'
import { cn } from '../lib/cn'
import {
  can,
  formatTeamsText,
  moveMember,
  otherSide,
  removeMember,
  ROOM_PERMISSIONS,
  ROOM_ROLE_LABEL,
  roomAction,
  roomRole,
  type RoomRole,
  type Side,
  type Teams,
} from '../lib/room'
import { useToast } from '../context/AppContext'
import { ListStatus, SkeletonRows } from '../components/ui/ListStatus'
import { currentUser, useRoom, useRoomMessages, type ChatMessage, type Lane, type Room, type RoomMember } from '../api'
import { Button, ButtonLink, IconButton } from '../components/ui/Button'
import { Avatar, Badge } from '../components/ui/primitives'
import { PageHeader } from '../components/layout/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { useDismiss } from '../components/layout/hooks'
import { EmptyState } from '../components/domain/EmptyState'
import { MODE_LABEL, splitRoomMembers, type TeamSplitRequest } from '../features/team-split/teamSplit'

const LANE_ICON: Record<Lane, LucideIcon> = {
  TOP: Shield,
  JG: PawPrint,
  MID: Feather,
  AD: Crosshair,
  SP: ShieldPlus,
}

const LANE_NAME: Record<Lane, string> = {
  TOP: 'Đường trên',
  JG: 'Đi rừng',
  MID: 'Đường giữa',
  AD: 'Xạ thủ',
  SP: 'Trợ thủ',
}

const TEAM_NAME: Record<Side, string> = { blue: 'Team Xanh', red: 'Team Đỏ' }

type ToolTab = 'tools' | 'config' | 'notes'

const TOOLS: Array<{ icon: LucideIcon; title: string; desc: string; split?: TeamSplitRequest }> = [
  // Cân bằng theo Tier với bảng điểm mặc định của team-core (chưa có UI chọn bảng điểm / mức cân bằng).
  { icon: Scale, title: 'Chia đội cân bằng', desc: 'Theo chỉ số / rank / lịch sử', split: { mode: 'tier' } },
  { icon: Shuffle, title: 'Random lane', desc: 'Phân vị trí ngẫu nhiên' },
  { icon: RefreshCw, title: 'Random tướng', desc: 'Bốc tướng ngẫu nhiên' },
  { icon: Gift, title: 'Hộp bí ẩn', desc: 'Tướng / skin / thử thách' },
  { icon: MonitorPlay, title: 'Chế độ trình chiếu', desc: 'Hiện kết quả toàn màn hình' },
]

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const nowHHMM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function RoomDetail() {
  const { roomId } = useParams()
  const load = useRoom(roomId)
  const room = load.data
  if (load.status !== 'ready') {
    return (
      <ListStatus status={load.status} onRetry={load.retry} label="phòng" className="mt-6" skeleton={<SkeletonRows count={6} />}>
        {null}
      </ListStatus>
    )
  }
  if (!room) {
    return (
      <EmptyState
        className="mt-6 min-h-96"
        icon={<Gamepad2 size={32} />}
        as="h1"
        title="Không tìm thấy phòng"
        description={`Phòng #${roomId ?? ''} không tồn tại hoặc đã đóng.`}
        action={
          <ButtonLink to="/dashboard" variant="outline">
            Về trang chủ
          </ButtonLink>
        }
      />
    )
  }
  // key: đổi phòng thì reset toàn bộ state (đội đã sửa, tin nhắn…)
  return <RoomView key={room.id} room={room} />
}

/**
 * Trang phòng. Góc nhìn theo vai trò (lib/room.ts › ROOM_PERMISSIONS):
 * - Chủ phòng: chia lại, công cụ random, kéo thả / menu đổi đội, mời ra khỏi phòng, chat, xuất kết quả.
 * - Người chơi: chat, xuất kết quả.
 * - Khán giả: chỉ xem (chat chỉ đọc).
 * Nút vàng đặc duy nhất: "Xuất kết quả chia đội" (thành viên) hoặc "Tham gia phòng" (khán giả, phòng còn chỗ).
 */
function RoomView({ room }: { room: Room }) {
  const { comingSoon, notify } = useToast()
  const role = roomRole(room, currentUser.id)
  const isHost = role === 'host'
  const perSide = room.capacity / 2

  const [tab, setTab] = useState<ToolTab>('tools')
  const [teams, setTeams] = useState<Teams>({ blue: room.teams.blue, red: room.teams.red })
  const playerCount = teams.blue.length + teams.red.length

  const copyCode = async () => {
    const ok = await copyText(`#${room.id}`)
    notify(ok ? 'Đã sao chép mã phòng' : 'Không thể sao chép', ok ? `#${room.id}` : 'Trình duyệt chặn clipboard.')
  }
  const share = async () => {
    const ok = await copyText(window.location.href)
    notify(ok ? 'Đã sao chép liên kết phòng' : 'Không thể sao chép', ok ? 'Gửi liên kết cho bạn bè để mời vào phòng.' : undefined)
  }
  const exportResult = async () => {
    const ok = await copyText(formatTeamsText(room, teams))
    notify(
      ok ? 'Đã sao chép kết quả chia đội' : 'Không thể sao chép',
      ok ? 'Dán vào Zalo / Discord để gửi cho cả phòng.' : 'Trình duyệt chặn clipboard.',
    )
  }

  const runSplit = (request: TeamSplitRequest) => {
    const outcome = splitRoomMembers([...teams.blue, ...teams.red], request)
    if (!outcome.ok) {
      notify('Không thể chia đội', outcome.message)
      return
    }
    setTeams({ blue: outcome.teams.blue, red: outcome.teams.red })
    if (outcome.warning) {
      notify('Chưa đạt mức cân bằng mong muốn', 'Đã chọn phương án chia gần 50/50 nhất có thể.')
    } else {
      notify('Đã chia đội', `${MODE_LABEL[outcome.mode]} · 5 vs 5`)
    }
  }

  const move = (playerId: string, to: Side, targetId?: string) => {
    const res = moveMember(teams, playerId, to, perSide, targetId)
    if (!res.ok) {
      notify('Không thể đổi đội', res.message)
      return
    }
    if (res.teams === teams) return
    setTeams(res.teams)
    const name = [...teams.blue, ...teams.red].find((m) => m.player.id === playerId)?.player.name
    notify(res.swapped ? `Đã đổi chỗ ${name} và ${res.swapped}` : `Đã chuyển ${name} sang ${TEAM_NAME[to]}`)
  }

  const kick = (m: RoomMember) => {
    setTeams((t) => removeMember(t, m.player.id))
    notify(`Đã mời ${m.player.name} ra khỏi phòng`, 'Chỗ trống có thể mời người khác vào.')
  }

  const VisibilityIcon = room.visibility === 'private' ? Lock : Globe
  const canJoin = role === 'spectator' && roomAction(room, currentUser.id) === 'join'

  return (
    <div className="flex flex-col">
      <PageHeader
        title={
          <>
            {room.title}
            {room.highlight && (
              <>
                {' – '}
                <span className="text-gold-gradient">{room.highlight}</span>
              </>
            )}
          </>
        }
        meta={
          <div className="flex flex-col gap-3">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-base text-fg/90" aria-label="Thông tin phòng">
              <li className="flex items-center gap-2">
                <Gamepad2 size={20} aria-hidden className="text-fg-muted" />
                {room.modeLabel}
              </li>
              <li className="flex items-center gap-2">
                <VisibilityIcon size={18} aria-hidden className="text-fg-muted" />
                {room.visibility === 'private' ? 'Private' : 'Public'}
              </li>
              <li className="flex items-center gap-2">
                <UserRound size={18} aria-hidden className="text-fg-muted" />
                <span>
                  Tạo bởi <span className="font-semibold text-gold">{room.host.name}</span>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <UsersRound size={18} aria-hidden className="text-fg-muted" />
                <span className="tabular">
                  {playerCount}/{room.capacity}
                  <span className="sr-only"> người chơi</span>
                </span>
              </li>
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-10 w-fit items-center gap-3 rounded-btn border border-line-strong bg-surface-2/80 pr-1 pl-4 text-base">
                <span className="text-fg-muted">Mã phòng</span>
                <span className="font-semibold tabular">#{room.id}</span>
                <IconButton label="Sao chép mã phòng" variant="ghost" className="size-8" onClick={copyCode}>
                  <Copy size={16} aria-hidden />
                </IconButton>
              </div>
              <RoleBadge role={role} />
            </div>
          </div>
        }
        actions={
          <>
            <Button variant="outline" leftIcon={<Share2 size={18} aria-hidden />} onClick={share}>
              Chia sẻ
            </Button>
            {isHost && (
              <Button
                variant="outline"
                leftIcon={<Shuffle size={18} aria-hidden />}
                title="Chia ngẫu nhiên lại hai đội"
                onClick={() => runSplit({ mode: 'random' })}
              >
                Chia lại
              </Button>
            )}
            {can(role, 'export') && (
              <Button leftIcon={<Download size={18} aria-hidden />} onClick={exportResult}>
                Xuất kết quả chia đội
              </Button>
            )}
            {canJoin && (
              <Button leftIcon={<LogIn size={18} aria-hidden />} onClick={() => comingSoon(`Tham gia phòng #${room.id}`)}>
                Tham gia phòng
              </Button>
            )}
          </>
        }
      />

      {/*
        < 768: đội xanh → đội đỏ → công cụ → chat.
        768–1279: 2 đội cạnh nhau, công cụ và chat toàn chiều rộng.
        ≥ 1280: 2 đội + chat (cột 1–2), công cụ ở cột 3 trải 2 hàng.
      */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,0.9fr)] xl:grid-rows-[auto_1fr] xl:items-start">
        {(['blue', 'red'] as const).map((side) => (
          <TeamPanel
            key={side}
            side={side}
            members={teams[side]}
            capacity={perSide}
            editable={isHost}
            hostId={room.host.id}
            onMove={move}
            onKick={kick}
            onInvite={() => comingSoon('Mời người chơi')}
          />
        ))}

        <section
          aria-label="Bảng công cụ"
          className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface/90 md:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1"
        >
          <Tabs<ToolTab>
            label="Công cụ phòng"
            idPrefix="room-tools"
            stretch
            value={tab}
            onChange={setTab}
            className="mx-2 mt-2 h-12 border-line"
            itemClassName="text-base rounded-t-btn aria-selected:bg-white/[0.06]"
            items={[
              { id: 'tools', label: 'Công cụ' },
              { id: 'config', label: 'Cấu hình' },
              { id: 'notes', label: 'Ghi chú' },
            ]}
          />
          <div id="room-tools-panel" role="tabpanel" aria-labelledby={`room-tools-tab-${tab}`} className="flex-1 p-4">
            {tab === 'tools' ? (
              <>
                {!isHost && (
                  <p className="mb-3 rounded-btn bg-surface-2/80 px-3 py-2 text-sm text-fg-muted">
                    Chỉ chủ phòng ({room.host.name}) dùng được các công cụ chia đội và random.
                  </p>
                )}
                <ul className="flex flex-col gap-3">
                  {TOOLS.map(({ icon: Icon, title, desc, split }) => (
                    <li key={title}>
                      <button
                        type="button"
                        disabled={!isHost}
                        onClick={() => (split ? runSplit(split) : comingSoon(title))}
                        className="group flex min-h-16 w-full items-center gap-4 rounded-btn border border-line bg-surface-2/80 py-3 pr-4 pl-3 text-left transition-[background-color,border-color] duration-150 enabled:hover:border-gold/35 enabled:hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span
                          aria-hidden
                          className="grid size-12 shrink-0 place-items-center rounded-btn bg-surface-3 text-fg ring-1 ring-white/5 transition-colors group-enabled:group-hover:text-gold"
                        >
                          <Icon size={24} strokeWidth={1.7} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-semibold">{title}</span>
                          <span className="mt-1 block text-sm text-fg-muted">{desc}</span>
                        </span>
                        <ChevronRight
                          size={20}
                          aria-hidden
                          className="shrink-0 text-fg-muted transition-transform group-enabled:group-hover:translate-x-0.5 group-enabled:group-hover:text-gold"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : tab === 'config' ? (
              <RoomConfig room={room} role={role} />
            ) : (
              <EmptyState
                className="min-h-60"
                icon={<MessageSquareText size={28} />}
                title="Chưa có ghi chú"
                description={
                  isHost
                    ? 'Ghi chú luật riêng của phòng (cấm tướng, giờ bắt đầu…) sẽ có ở bản sau.'
                    : 'Chủ phòng chưa thêm ghi chú nào.'
                }
              />
            )}
          </div>
        </section>

        <RoomChat
          room={room}
          canChat={can(role, 'chat')}
          className="md:col-span-2 xl:col-start-1 xl:row-start-2"
        />
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: RoomRole }) {
  const Icon = role === 'host' ? Crown : role === 'player' ? UserRound : Eye
  return (
    <Badge tone={role === 'host' ? 'gold-outline' : 'neutral'} icon={<Icon size={14} aria-hidden />} className="py-1 text-sm">
      Bạn là {ROOM_ROLE_LABEL[role].toLowerCase()}
    </Badge>
  )
}

/* ---------------- Đội ---------------- */

const DRAG_TYPE = 'text/x-customaov-player'

function TeamPanel({
  side,
  members,
  capacity,
  editable,
  hostId,
  onMove,
  onKick,
  onInvite,
}: {
  side: Side
  members: RoomMember[]
  capacity: number
  editable: boolean
  hostId: string
  onMove: (playerId: string, to: Side, targetId?: string) => void
  onKick: (m: RoomMember) => void
  onInvite: () => void
}) {
  const blue = side === 'blue'
  const name = TEAM_NAME[side]
  const empty = Math.max(0, capacity - members.length)
  const [dragOver, setDragOver] = useState(false)

  const dropProps = editable
    ? {
        onDragOver: (e: DragEvent) => {
          if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOver(true)
        },
        onDragLeave: (e: DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault()
          setDragOver(false)
          const id = e.dataTransfer.getData(DRAG_TYPE)
          const target = (e.target as HTMLElement).closest<HTMLElement>('[data-player-id]')?.dataset.playerId
          if (id) onMove(id, side, target && target !== id ? target : undefined)
        },
      }
    : {}

  return (
    <section
      aria-label={name}
      {...dropProps}
      className={cn(
        'min-w-0 overflow-hidden rounded-card border transition-[border-color,box-shadow] duration-150',
        blue ? 'border-team-blue/25 bg-team-blue-body' : 'border-team-red/25 bg-team-red-body',
        dragOver && 'border-gold/70 ring-2 ring-gold/40',
      )}
    >
      <header
        className={cn(
          'flex min-h-20 items-center gap-4 border-b px-4 py-3 sm:px-6',
          blue
            ? 'border-team-blue/20 bg-[linear-gradient(90deg,var(--color-team-blue-bg),var(--color-team-blue-body))]'
            : 'border-team-red/20 bg-[linear-gradient(90deg,var(--color-team-red-bg),var(--color-team-red-body))]',
        )}
      >
        <img src={asset(blue ? 'emblem-xanh.png' : 'emblem-do.png')} alt="" className="h-14 w-12 object-contain mix-blend-lighten" />
        <h2 className="text-2xl font-bold">{name}</h2>
        <span className="ml-auto text-sm text-fg-muted tabular">
          {members.length}/{capacity}
        </span>
      </header>
      <ul className="px-4 py-2 sm:px-6">
        {members.map((mem, i) => (
          <MemberRow
            key={mem.player.id}
            member={mem}
            side={side}
            first={i === 0}
            editable={editable}
            isHost={mem.player.id === hostId}
            onMove={onMove}
            onKick={onKick}
          />
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <li
            key={`empty-${i}`}
            className={cn('flex min-h-16 items-center gap-3 py-2', (members.length > 0 || i > 0) && 'border-t border-line')}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-dashed border-white/20 text-fg-subtle">
              <UserPlus size={20} aria-hidden />
            </span>
            <span className="flex-1 text-base text-fg-muted">{editable ? 'Chỗ trống · thả người vào đây' : 'Chỗ trống'}</span>
            {editable && (
              <Button size="sm" variant="secondary" onClick={onInvite}>
                Mời
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <p className="border-t border-line px-4 py-2 text-xs text-fg-muted sm:px-6">
          Kéo thả để đổi đội, hoặc dùng menu <MoreVertical size={12} aria-hidden className="inline align-[-1px]" /> ở mỗi người
          chơi.
        </p>
      )}
    </section>
  )
}

function MemberRow({
  member,
  side,
  first,
  editable,
  isHost,
  onMove,
  onKick,
}: {
  member: RoomMember
  side: Side
  first: boolean
  editable: boolean
  isHost: boolean
  onMove: (playerId: string, to: Side) => void
  onKick: (m: RoomMember) => void
}) {
  const LaneIcon = LANE_ICON[member.lane]
  const [dragging, setDragging] = useState(false)
  return (
    <li
      data-player-id={member.player.id}
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, member.player.id)
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        'flex min-h-16 items-center gap-3 py-2',
        !first && 'border-t border-line',
        editable && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      {editable && <GripVertical size={16} aria-hidden className="-mr-1 hidden shrink-0 text-fg-subtle sm:block" />}
      <Avatar src={member.player.avatar} name={member.player.name} alt="" size={44} className="ring-2 ring-white/10" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-base font-semibold">
          <span className="min-w-0 break-words">{member.player.name}</span>
          {isHost && <Crown size={16} aria-label="Chủ phòng" className="shrink-0 fill-gold text-gold" />}
        </p>
        {member.captain && (
          <span className="mt-1 inline-block rounded-btn bg-gold-tint px-2 text-xs leading-5 text-gold">Đội trưởng</span>
        )}
      </div>
      <span
        title={LANE_NAME[member.lane]}
        className="inline-flex h-8 min-w-16 shrink-0 items-center justify-center gap-2 rounded-btn bg-lane-chip px-2 text-sm font-medium ring-1 ring-white/5"
      >
        <LaneIcon size={16} aria-hidden className="text-fg/80" />
        {member.lane}
        <span className="sr-only">({LANE_NAME[member.lane]})</span>
      </span>
      {member.ready ? (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ready" title="Đã sẵn sàng">
          <Check size={16} strokeWidth={3.2} aria-hidden className="text-white" />
          <span className="sr-only">Đã sẵn sàng</span>
        </span>
      ) : (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-3" title="Chưa sẵn sàng">
          <Clock3 size={14} aria-hidden className="text-fg-muted" />
          <span className="sr-only">Chưa sẵn sàng</span>
        </span>
      )}
      {editable && <MemberMenu member={member} side={side} isHost={isHost} onMove={onMove} onKick={onKick} />}
    </li>
  )
}

/** Menu thay thế cho kéo thả (bàn phím / màn cảm ứng): đổi đội, mời ra khỏi phòng */
function MemberMenu({
  member,
  side,
  isHost,
  onMove,
  onKick,
}: {
  member: RoomMember
  side: Side
  isHost: boolean
  onMove: (playerId: string, to: Side) => void
  onKick: (m: RoomMember) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const to = otherSide(side)
  const item =
    'flex min-h-11 w-full items-center gap-3 rounded-btn px-3 text-left text-sm transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'

  return (
    <div ref={ref} className="relative shrink-0">
      <IconButton
        label={`Tuỳ chọn cho ${member.player.name}`}
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        className="size-8"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={18} aria-hidden />
      </IconButton>
      {open && (
        <div
          role="menu"
          aria-label={`Tuỳ chọn cho ${member.player.name}`}
          className="absolute top-full right-0 z-30 mt-1 w-56 rounded-card border border-line-strong bg-surface-2 p-1 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)]"
        >
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              close()
              onMove(member.player.id, to)
            }}
          >
            <ArrowLeftRight size={16} aria-hidden className="text-gold" /> Chuyển sang {TEAM_NAME[to]}
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={isHost}
            title={isHost ? 'Không thể mời chủ phòng ra khỏi phòng' : undefined}
            className={cn(item, 'text-danger')}
            onClick={() => {
              close()
              onKick(member)
            }}
          >
            <UserMinus size={16} aria-hidden /> Mời ra khỏi phòng
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------------- Cấu hình (tóm tắt + bảng quyền) ---------------- */

function RoomConfig({ room, role }: { room: Room; role: RoomRole }) {
  const roles: RoomRole[] = ['host', 'player', 'spectator']
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {[
          ['Chế độ', room.modeLabel],
          ['Hiển thị', room.visibility === 'private' ? 'Private (cần mã)' : 'Public'],
          ['Sức chứa', `${room.capacity} người (${room.capacity / 2} vs ${room.capacity / 2})`],
          ['Chủ phòng', room.host.name],
        ].map(([k, v]) => (
          <div key={k} className="rounded-btn bg-surface-2/80 px-3 py-2">
            <dt className="text-xs text-fg-muted">{k}</dt>
            <dd className="mt-1 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="text-sm font-semibold">Quyền trong phòng</h3>
        <div className="relative mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Ai được làm gì trong phòng</caption>
            <thead>
              <tr className="text-xs text-fg-muted">
                <th scope="col" className="py-2 pr-2 font-medium">
                  Hành động
                </th>
                {roles.map((r) => (
                  <th
                    key={r}
                    scope="col"
                    className={cn('px-1 py-2 text-center font-medium whitespace-nowrap', r === role && 'text-gold')}
                  >
                    {ROOM_ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROOM_PERMISSIONS.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <th scope="row" className="py-2 pr-2 font-normal">
                    {p.label}
                  </th>
                  {roles.map((r) => (
                    <td key={r} className="px-1 py-2 text-center">
                      {p.roles.includes(r) ? (
                        <Check size={16} aria-label="Được phép" className="inline text-success" />
                      ) : (
                        <X size={16} aria-label="Không" className="inline text-fg-subtle" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Chat ---------------- */

function RoomChat({ room, canChat, className }: { room: Room; canChat: boolean; className?: string }) {
  const load = useRoomMessages(room.id)
  const [messages, setMessages] = useState<ChatMessage[]>(load.data)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    if (load.status === 'ready') setMessages(load.data)
  }, [load.status, load.data])

  // Tin mới → cuộn xuống cuối khung chat (chỉ trong khung, không cuộn cả trang)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setMessages((list) => [...list, { id: `local-${list.length}-${Date.now()}`, author: currentUser, text, time: nowHHMM() }])
    setDraft('')
  }

  return (
    <section aria-labelledby="room-chat-title" className={cn('flex min-w-0 flex-col rounded-card border border-line bg-surface/90', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="room-chat-title" className="flex items-center gap-3 text-base font-semibold">
          <MessageSquareText size={20} aria-hidden className="text-gold" />
          Chat phòng
        </h2>
        <span className="text-xs text-fg-muted tabular">{messages.length} tin nhắn</span>
      </div>

      {load.status !== 'ready' ? (
        <ListStatus status={load.status} onRetry={load.retry} label="tin nhắn" className="m-3" skeleton={<SkeletonRows count={3} className="px-1" />}>
          {null}
        </ListStatus>
      ) : messages.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-fg-muted">Chưa có tin nhắn nào. Hãy chào mọi người trong phòng!</p>
      ) : (
        <ol ref={listRef} role="log" aria-label="Tin nhắn trong phòng" className="relative flex max-h-80 flex-col gap-3 overflow-y-auto px-4 py-3">
          {messages.map((m) => {
            const mine = m.author.id === currentUser.id
            return (
              <li key={m.id} className={cn('flex items-start gap-3', mine && 'flex-row-reverse')}>
                <Avatar src={m.author.avatar} name={m.author.name} alt="" size={32} />
                <div className={cn('flex max-w-[75%] min-w-0 flex-col', mine && 'items-end')}>
                  <p className="flex items-baseline gap-2 text-xs text-fg-muted">
                    <span className={cn('font-semibold', mine ? 'text-gold' : 'text-fg')}>{mine ? 'Bạn' : m.author.name}</span>
                    <time className="tabular">{m.time}</time>
                  </p>
                  <p
                    className={cn(
                      'mt-1 rounded-card px-3 py-2 text-sm break-words',
                      mine ? 'rounded-tr-btn bg-gold-tint text-fg' : 'rounded-tl-btn bg-surface-2',
                    )}
                  >
                    {m.text}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <form
        className="mt-auto border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <div className="flex h-12 items-center rounded-btn border border-line-strong bg-surface-2/80 pr-1 pl-4 transition-colors focus-within:border-gold/60">
          <label htmlFor="room-chat" className="sr-only">
            Nhập tin nhắn
          </label>
          <input
            id="room-chat"
            value={draft}
            disabled={!canChat}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={canChat ? 'Nhập tin nhắn…' : 'Chỉ người trong phòng mới gửi được tin nhắn'}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg-muted disabled:cursor-not-allowed"
          />
          <IconButton label="Gửi tin nhắn" type="submit" variant="ghost" className="size-10" disabled={!canChat || !draft.trim()}>
            <SendHorizontal size={20} aria-hidden />
          </IconButton>
        </div>
      </form>
    </section>
  )
}
