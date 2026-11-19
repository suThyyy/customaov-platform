import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { RoomDetail as ApiRoomDetail, RoomSummary as ApiRoomSummary } from '@customaov/contracts'
import {
  ArrowLeftRight,
  DoorOpen,
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
  Trophy,
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
import { useAuth, useToast } from '../context/AppContext'
import { ListStatus, SkeletonRows } from '../components/ui/ListStatus'
import {
  ApiError,
  currentUser,
  fromApiRoomDetail,
  getRoomConfig,
  roomActions,
  roomsAdapter,
  isRoomDetail,
  updateRoomConfig,
  useApiRoom,
  useApiRoomMessages,
  useRoom,
  useRoomChannel,
  useRoomMessages,
  type ChatMessage,
  type Lane,
  type Room,
  type RoomConfig as RoomConfigData,
  type RoomConfigEditable,
  type RoomMember,
} from '../api'
import { mapChatMessage, mapRoom } from '../api/map'
import { Button, ButtonLink, IconButton } from '../components/ui/Button'
import { Avatar, Badge } from '../components/ui/primitives'
import { PageHeader } from '../components/layout/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { useDismiss } from '../components/layout/hooks'
import { EmptyState } from '../components/domain/EmptyState'
import { RoomConfigPanel } from '../components/domain/RoomConfigPanel'
import { SupabaseRoomView } from '../components/domain/SupabaseRoomView'
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

/**
 * `/rooms/:roomId`. Chế độ `mock` giữ nguyên hành vi Phase 4b (sửa đội tại chỗ).
 * Chế độ `api` tải phòng từ server, mọi thao tác gọi API và nhận cập nhật qua WebSocket.
 */
export default function RoomDetail() {
  const { roomId } = useParams()
  if (roomsAdapter.roomView === 'open-room') return <SupabaseRoomView roomId={roomId} />
  return roomsAdapter.supportsRealtime ? <ApiRoomDetail /> : <MockRoomDetail />
}

function MockRoomDetail() {
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
  if (!room) return <RoomNotFound code={roomId} />
  // key: đổi phòng thì reset toàn bộ state (đội đã sửa, tin nhắn…)
  return <MockRoomView key={room.id} room={room} />
}

function RoomNotFound({ code }: { code?: string }) {
  return (
    <EmptyState
      className="mt-6 min-h-96"
      icon={<Gamepad2 size={32} />}
      as="h1"
      title="Không tìm thấy phòng"
      description={`Phòng #${code ?? ''} không tồn tại hoặc đã đóng.`}
      action={
        <ButtonLink to="/dashboard" variant="outline">
          Về trang chủ
        </ButtonLink>
      }
    />
  )
}

/* ---------------- Hợp đồng giữa trang phòng và nguồn dữ liệu ---------------- */

interface RoomActions {
  share: () => void
  split: (request: TeamSplitRequest) => void
  move: (playerId: string, to: Side, targetId?: string) => void
  kick: (member: RoomMember) => void
  exportResult: () => void
  /** Bấm một công cụ ở tab "Công cụ" */
  tool: (title: string, split?: TeamSplitRequest) => void
}

/** Chỉ có ở chế độ `api`: trạng thái server và các thao tác của thành viên. */
interface LiveRoom {
  /** `null` = chưa vào phòng (không phải thành viên) */
  myRole: RoomRole | null
  status: ApiRoomDetail['status']
  result: Side | null
  /** Người chơi chưa chọn lane (id theo `Player.id`) */
  unsetLanes: ReadonlySet<string>
  /** Dòng của chính mình trong một đội (host/người chơi) */
  me?: RoomMember
  busy: boolean
  join: (as: 'player' | 'spectator') => void
  leave: () => void
  setLane: (lane: Lane) => void
  toggleReady: () => void
  submitResult: (winner: Side) => void
}

const shareCopy = async (notify: (title: string, description?: string) => void, url: string) => {
  const ok = await copyText(url)
  notify(ok ? 'Đã sao chép liên kết phòng' : 'Không thể sao chép', ok ? 'Gửi liên kết cho bạn bè để mời vào phòng.' : undefined)
}

/* ---------------- Chế độ mock: sửa đội tại chỗ ---------------- */

function MockRoomView({ room }: { room: Room }) {
  const { comingSoon, notify } = useToast()
  const role = roomRole(room, currentUser.id)
  const perSide = room.capacity / 2
  const [teams, setTeams] = useState<Teams>({ blue: room.teams.blue, red: room.teams.red })

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

  const [roomConfig, setRoomConfig] = useState<RoomConfigData | null>(null)
  const [configPending, setConfigPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getRoomConfig(room.id).then((res) => {
      if (!cancelled) setRoomConfig(res.config)
    })
    return () => { cancelled = true }
  }, [room.id])

  const handleUpdateConfig = async (editable: RoomConfigEditable) => {
    if (configPending) return
    setConfigPending(true)
    try {
      const res = await updateRoomConfig(room.id, editable)
      setRoomConfig((prev) => (prev ? { ...prev, ...res.config } : prev))
      notify('Đã cập nhật cấu hình')
    } catch (err) {
      notify('Không thể cập nhật cấu hình', err instanceof Error ? err.message : 'Vui lòng thử lại.')
    } finally {
      setConfigPending(false)
    }
  }

  return (
    <RoomView
      room={room}
      teams={teams}
      role={role}
      config={roomConfig}
      configPending={configPending}
      onUpdateConfig={handleUpdateConfig}
      actions={{
        share: () => shareCopy(notify, window.location.href),
        split: runSplit,
        move,
        kick,
        exportResult,
        tool: (title, split) => (split ? runSplit(split) : comingSoon(title)),
      }}
      chat={(className) => <MockRoomChat room={room} canChat={can(role, 'chat')} className={className} />}
    />
  )
}

/* ---------------- Chế độ api: server là nguồn sự thật ---------------- */

const errorText = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Không kết nối được máy chủ. Vui lòng thử lại.'

function ApiRoomDetail() {
  const { roomId } = useParams()
  const [params] = useSearchParams()
  const joinKey = params.get('key') ?? undefined
  // key: đổi phòng (hoặc mã mời) thì huỷ kênh realtime cũ và reset toàn bộ state
  return <ApiRoomLoader key={`${roomId ?? ''}#${joinKey ?? ''}`} code={roomId} joinKey={joinKey} />
}

function ApiRoomLoader({ code, joinKey }: { code?: string; joinKey?: string }) {
  const navigate = useNavigate()
  const { notify, comingSoon } = useToast()
  const { user } = useAuth()
  const { state, setRoom, reload } = useApiRoom(code, joinKey)
  const loaded = state.status === 'ready' ? state.room : undefined
  const detail = loaded && isRoomDetail(loaded) ? loaded : undefined
  const myRole = detail?.myRole ?? null
  const chat = useApiRoomMessages(code, myRole !== null)
  const { add: addMessage, reload: reloadMessages } = chat
  const channel = useRoomChannel(code, joinKey, {
    onRoomUpdated: setRoom,
    onChatMessage: addMessage,
    onKicked: () => {
      notify('Bạn đã bị mời ra khỏi phòng', `Chủ phòng đã mời bạn ra khỏi phòng #${code ?? ''}.`)
      navigate('/dashboard', { replace: true })
    },
    onReconnect: () => {
      reload()
      reloadMessages()
    },
  })
  const [busy, setBusy] = useState(false)

  if (state.status === 'loading' || state.status === 'error') {
    return (
      <ListStatus status={state.status} onRetry={reload} label="phòng" className="mt-6" skeleton={<SkeletonRows count={6} />}>
        {null}
      </ListStatus>
    )
  }
  if (state.status === 'not-found' || !code) return <RoomNotFound code={code} />

  /** Gọi một mutation phòng: thành công thì lấy ảnh chụp mới, lỗi (409/403…) thì toast thông báo của server. */
  const run = async (failTitle: string, request: () => Promise<ApiRoomDetail>): Promise<ApiRoomDetail | undefined> => {
    setBusy(true)
    try {
      const room = await request()
      setRoom(room)
      return room
    } catch (error) {
      notify(failTitle, errorText(error))
      return undefined
    } finally {
      setBusy(false)
    }
  }

  const join = async (as: 'player' | 'spectator') => {
    // Khán giả muốn vào đội: server yêu cầu rời vai khán giả trước (join khi đã là thành viên → 409).
    const switching = as === 'player' && myRole === 'spectator'
    const room = await run(as === 'player' ? 'Không thể vào phòng' : 'Không thể vào xem', async () => {
      if (switching) await roomActions.leave(code)
      return roomActions.join(code, joinKey ? { as, key: joinKey } : { as })
    })
    if (!room) {
      if (switching) reload()
      return
    }
    // Phòng riêng tư: lần subscribe đầu có thể bị từ chối khi chưa là thành viên.
    channel.resubscribe()
    if (as === 'spectator') {
      notify(`Đang xem phòng #${room.code}`, 'Khán giả xem được đội hình và chat, nhưng không gửi tin.')
    } else {
      const side = room.teams.red.some((m) => m.user.username === user?.username) ? 'red' : 'blue'
      notify(`Đã vào phòng #${room.code}`, `Bạn ở ${TEAM_NAME[side]}. Chọn lane và bấm sẵn sàng nhé!`)
    }
  }

  if (!detail) return <RestrictedRoom room={loaded!} busy={busy} onJoin={() => join('player')} />

  return (
    <ApiRoomView
      key={detail.code}
      detail={detail}
      username={user?.username}
      busy={busy}
      run={run}
      join={join}
      onLeft={() => {
        if (detail.visibility === 'private' && !joinKey) reload()
      }}
      chat={chat.state}
      onMessage={addMessage}
      onRetryChat={reloadMessages}
      notify={notify}
      comingSoon={comingSoon}
    />
  )
}

function ApiRoomView({
  detail,
  username,
  busy,
  run,
  join,
  onLeft,
  chat,
  onMessage,
  onRetryChat,
  notify,
  comingSoon,
}: {
  detail: ApiRoomDetail
  username?: string
  busy: boolean
  run: (failTitle: string, request: () => Promise<ApiRoomDetail>) => Promise<ApiRoomDetail | undefined>
  join: (as: 'player' | 'spectator') => void
  onLeft: () => void
  chat: ReturnType<typeof useApiRoomMessages>['state']
  onMessage: ReturnType<typeof useApiRoomMessages>['add']
  onRetryChat: () => void
  notify: (title: string, description?: string) => void
  comingSoon: (feature: string) => void
}) {
  const code = detail.code
  const room = mapRoom(detail)
  const teams: Teams = room.teams
  const myRole = detail.myRole
  const role: RoomRole = myRole ?? 'spectator'
  const members = [...detail.teams.blue, ...detail.teams.red]
  const userIdOf = (playerId: string) => members.find((m) => m.user.username === playerId)?.user.id
  const unsetLanes = new Set(members.filter((m) => m.lane === null).map((m) => m.user.username))
  const me = username ? [...teams.blue, ...teams.red].find((m) => m.player.id === username) : undefined
  const nameOf = (playerId: string) => [...teams.blue, ...teams.red].find((m) => m.player.id === playerId)?.player.name

  const split = async (request: TeamSplitRequest) => {
    const next = await run('Không thể chia đội', () =>
      roomActions.split(code, request.mode === 'random' ? { mode: 'random' } : { mode: 'tier' }),
    )
    if (!next) return
    if (next.lastSplit?.warning) notify('Chưa đạt mức cân bằng mong muốn', 'Đã chọn phương án chia gần 50/50 nhất có thể.')
    else notify('Đã chia đội', `${MODE_LABEL[next.lastSplit?.mode ?? (request.mode === 'random' ? 'random' : 'tier')]} · 5 vs 5`)
  }

  const move = async (playerId: string, to: Side, targetId?: string) => {
    // Kiểm tra trước bằng đúng luật của server để báo lỗi ngay, không cần gọi API.
    const check = moveMember(teams, playerId, to, room.capacity / 2, targetId)
    if (!check.ok) {
      notify('Không thể đổi đội', check.message)
      return
    }
    if (check.teams === teams) return
    const userId = userIdOf(playerId)
    const targetUserId = targetId ? userIdOf(targetId) : undefined
    if (!userId) return
    const next = await run('Không thể đổi đội', () =>
      roomActions.moveMember(code, targetUserId ? { userId, to, targetUserId } : { userId, to }),
    )
    if (next) notify(check.swapped ? `Đã đổi chỗ ${nameOf(playerId)} và ${check.swapped}` : `Đã chuyển ${nameOf(playerId)} sang ${TEAM_NAME[to]}`)
  }

  const kick = async (member: RoomMember) => {
    const userId = userIdOf(member.player.id)
    if (!userId) return
    const next = await run('Không thể mời ra khỏi phòng', () => roomActions.kickMember(code, { userId }))
    if (next) notify(`Đã mời ${member.player.name} ra khỏi phòng`, 'Chỗ trống có thể mời người khác vào.')
  }

  const exportResult = async () => {
    let text: string
    try {
      text = await roomActions.export(code)
    } catch (error) {
      notify('Không thể xuất kết quả', errorText(error))
      return
    }
    const ok = await copyText(text)
    notify(
      ok ? 'Đã sao chép kết quả chia đội' : 'Không thể sao chép',
      ok ? 'Dán vào Zalo / Discord để gửi cho cả phòng.' : 'Trình duyệt chặn clipboard.',
    )
  }

  const randomLanes = async () => {
    const next = await run('Không thể random lane', () => roomActions.randomLanes(code))
    if (next) notify('Đã random lane', 'Mỗi đội có đủ 5 vị trí, không trùng nhau.')
  }

  const live: LiveRoom = {
    myRole,
    status: detail.status,
    result: detail.result?.winner ?? null,
    unsetLanes,
    me,
    busy,
    join,
    leave: async () => {
      const next = await run('Không thể rời phòng', () => roomActions.leave(code))
      if (!next) return
      notify(`Đã rời phòng #${code}`)
      onLeft()
    },
    setLane: (lane) => void run('Không thể chọn lane', () => roomActions.updateMe(code, { lane })),
    toggleReady: async () => {
      const next = await run('Không thể cập nhật sẵn sàng', () => roomActions.updateMe(code, { ready: !me?.ready }))
      if (next) notify(me?.ready ? 'Đã huỷ sẵn sàng' : 'Đã sẵn sàng', me?.ready ? undefined : 'Chờ chủ phòng chia đội và bắt đầu.')
    },
    submitResult: async (winner) => {
      const next = await run('Không thể ghi kết quả', () => roomActions.result(code, { winner }))
      if (next) notify('Đã ghi kết quả trận', `${TEAM_NAME[winner]} thắng. Phòng đã kết thúc.`)
    },
  }

  const send = async (text: string): Promise<boolean> => {
    try {
      onMessage(await roomActions.createMessage(code, { text }))
      return true
    } catch (error) {
      notify('Không gửi được tin nhắn', errorText(error))
      return false
    }
  }

  const [roomConfig, setRoomConfig] = useState<RoomConfigData>(() => fromApiRoomDetail(detail))
  const [configPending, setConfigPending] = useState(false)

  const handleUpdateConfig = async (editable: RoomConfigEditable) => {
    if (configPending) return
    setConfigPending(true)
    try {
      const res = await updateRoomConfig(code, editable)
      setRoomConfig((prev) => ({ ...prev, ...res.config }))
      notify('Đã cập nhật cấu hình')
    } catch (err) {
      notify('Không thể cập nhật cấu hình', err instanceof Error ? err.message : 'Vui lòng thử lại.')
    } finally {
      setConfigPending(false)
    }
  }

  return (
    <RoomView
      key={room.id}
      room={room}
      teams={teams}
      role={role}
      live={live}
      config={roomConfig}
      configPending={configPending}
      onUpdateConfig={handleUpdateConfig}
      actions={{
        share: () => shareCopy(notify, detail.shareUrl ? new URL(detail.shareUrl, window.location.origin).href : window.location.href),
        split,
        move,
        kick,
        exportResult,
        tool: (title, request) => {
          if (request) void split(request)
          else if (title === 'Random lane') void randomLanes()
          else comingSoon(title)
        },
      }}
      chat={(className) => (
        <RoomChat
          className={className}
          status={myRole === null ? 'ready' : chat.status === 'error' ? 'error' : chat.status === 'ready' ? 'ready' : 'loading'}
          onRetry={onRetryChat}
          messages={chat.messages.map(mapChatMessage)}
          meId={username}
          locked={myRole === null ? 'Vào phòng (người chơi hoặc khán giả) để xem chat.' : undefined}
          composer={myRole === null ? 'hidden' : can(role, 'chat') && detail.status !== 'finished' ? 'enabled' : 'hidden'}
          composerNote={
            myRole === 'spectator' ? 'Khán giả chỉ xem chat. Vào đội để gửi tin nhắn.' : detail.status === 'finished' ? 'Phòng đã kết thúc.' : undefined
          }
          onSend={send}
        />
      )}
    />
  )
}

/** Phòng riêng tư, người ngoài không có mã mời: chỉ thông tin cơ bản (API.md 9.1). */
function RestrictedRoom({ room, busy, onJoin }: { room: ApiRoomSummary; busy: boolean; onJoin: () => void }) {
  const ui = mapRoom(room)
  return (
    <div className="flex flex-col">
      <PageHeader
        title={<RoomTitle room={ui} />}
        meta={<RoomInfoList room={ui} playerCount={room.playerCount} config={null} />}
        actions={
          <Button leftIcon={<LogIn size={18} aria-hidden />} disabled={busy} onClick={onJoin}>
            Vào phòng
          </Button>
        }
      />
      <EmptyState
        className="mt-6 min-h-60"
        icon={<Lock size={28} />}
        as="h2"
        title="Phòng riêng tư"
        description="Đội hình và chat chỉ hiện với thành viên hoặc người có liên kết mời của chủ phòng."
      />
    </div>
  )
}

function RoomTitle({ room }: { room: Room }) {
  return (
    <>
      {room.title}
      {room.highlight && (
        <>
          {' – '}
          <span className="text-gold-gradient">{room.highlight}</span>
        </>
      )}
    </>
  )
}

function RoomInfoList({
  room,
  playerCount,
  config,
}: {
  room: Room
  playerCount: number
  config: RoomConfigData | null
}) {
  const access = config?.access ?? room.visibility
  const VisibilityIcon = access === 'private' ? Lock : Globe
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-base text-fg/90" aria-label="Thông tin phòng">
      {config && (
        <li className="flex items-center gap-2">
          <Gamepad2 size={20} aria-hidden className="text-fg-muted" />
          {config.series}
        </li>
      )}
      <li className="flex items-center gap-2">
        <VisibilityIcon size={18} aria-hidden className="text-fg-muted" />
        {access === 'private' ? 'Riêng tư' : 'Công khai'}
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
  )
}

/* ---------------- Giao diện trang phòng (dùng chung mock/api) ---------------- */

/**
 * Trang phòng. Góc nhìn theo vai trò (lib/room.ts › ROOM_PERMISSIONS):
 * - Chủ phòng: chia lại, công cụ random, kéo thả / menu đổi đội, mời ra khỏi phòng, chat, xuất kết quả.
 * - Người chơi: chat, xuất kết quả (api: chọn lane, sẵn sàng, rời phòng).
 * - Khán giả: chỉ xem (chat chỉ đọc).
 * Nút vàng đặc duy nhất: "Xuất kết quả chia đội" (thành viên) hoặc "Tham gia phòng"/"Vào phòng" (khán giả, phòng còn chỗ).
 */
function RoomView({
  room,
  teams,
  role,
  actions,
  chat,
  live,
  config = null,
  configPending = false,
  onUpdateConfig,
}: {
  room: Room
  teams: Teams
  role: RoomRole
  actions: RoomActions
  chat: (className: string) => ReactNode
  live?: LiveRoom
  config?: RoomConfigData | null
  configPending?: boolean
  onUpdateConfig?: (next: RoomConfigEditable) => void | Promise<void>
}) {
  const { comingSoon, notify } = useToast()
  const perSide = room.capacity / 2
  const [tab, setTab] = useState<ToolTab>('tools')
  const playerCount = teams.blue.length + teams.red.length
  const finished = live?.status === 'finished'
  const busy = live?.busy ?? false
  const canSplit = can(role, 'split') && !finished
  const canEdit = can(role, 'move') && !finished
  const outsider = live ? live.myRole === null : false
  // Mock: khán giả + phòng còn chỗ → "Tham gia phòng" (chưa có chức năng).
  const canJoinMock = !live && role === 'spectator' && roomAction(room, currentUser.id) === 'join'
  // Api: vào đội được khi chưa là người chơi, phòng đang chờ và còn chỗ.
  const canJoinTeam = !!live && (live.myRole === null || live.myRole === 'spectator') && live.status === 'waiting' && playerCount < room.capacity

  const copyCode = async () => {
    const ok = await copyText(`#${room.id}`)
    notify(ok ? 'Đã sao chép mã phòng' : 'Không thể sao chép', ok ? `#${room.id}` : 'Trình duyệt chặn clipboard.')
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={<RoomTitle room={room} />}
        meta={
          <div className="flex flex-col gap-3">
            <RoomInfoList room={room} playerCount={playerCount} config={config} />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-10 w-fit items-center gap-3 rounded-btn border border-line-strong bg-surface-2/80 pr-1 pl-4 text-base">
                <span className="text-fg-muted">Mã phòng</span>
                <span className="font-semibold tabular">#{room.id}</span>
                <IconButton label="Sao chép mã phòng" variant="ghost" className="size-8" onClick={copyCode}>
                  <Copy size={16} aria-hidden />
                </IconButton>
              </div>
              <RoleBadge role={role} outsider={outsider} />
              {finished && (
                <Badge tone="neutral" icon={<Trophy size={14} aria-hidden />} className="py-1 text-sm">
                  {live?.result ? `Đã kết thúc · ${TEAM_NAME[live.result]} thắng` : 'Đã kết thúc'}
                </Badge>
              )}
            </div>
          </div>
        }
        actions={
          <>
            <Button variant="outline" leftIcon={<Share2 size={18} aria-hidden />} onClick={actions.share}>
              Chia sẻ
            </Button>
            {canSplit && (
              <Button
                variant="outline"
                leftIcon={<Shuffle size={18} aria-hidden />}
                title="Chia ngẫu nhiên lại hai đội"
                disabled={busy}
                onClick={() => actions.split({ mode: 'random' })}
              >
                Chia lại
              </Button>
            )}
            {can(role, 'export') && (
              <Button leftIcon={<Download size={18} aria-hidden />} onClick={actions.exportResult}>
                Xuất kết quả chia đội
              </Button>
            )}
            {canJoinMock && (
              <Button leftIcon={<LogIn size={18} aria-hidden />} onClick={() => comingSoon(`Tham gia phòng #${room.id}`)}>
                Tham gia phòng
              </Button>
            )}
            {live && canJoinTeam && (
              <Button leftIcon={<LogIn size={18} aria-hidden />} disabled={busy} onClick={() => live.join('player')}>
                {live.myRole === 'spectator' ? 'Vào đội' : 'Vào phòng'}
              </Button>
            )}
            {live && live.myRole === null && !finished && (
              <Button variant="outline" leftIcon={<Eye size={18} aria-hidden />} disabled={busy} onClick={() => live.join('spectator')}>
                Vào xem
              </Button>
            )}
            {live && live.myRole !== null && !finished && (
              <Button variant="ghost" leftIcon={<DoorOpen size={18} aria-hidden />} disabled={busy} onClick={live.leave}>
                Rời phòng
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
            editable={canEdit}
            canKick={can(role, 'kick')}
            hostId={room.host.id}
            unsetLanes={live?.unsetLanes}
            onMove={actions.move}
            onKick={actions.kick}
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
                {live?.me && !finished && <MySlot me={live.me} laneUnset={live.unsetLanes.has(live.me.player.id)} busy={busy} onLane={live.setLane} onReady={live.toggleReady} />}
                {live && role === 'host' && (
                  <MatchResult
                    result={live.result}
                    finished={finished}
                    full={playerCount === room.capacity}
                    busy={busy}
                    onSubmit={live.submitResult}
                  />
                )}
                {finished ? (
                  <p className="mb-3 rounded-btn bg-surface-2/80 px-3 py-2 text-sm text-fg-muted">
                    Phòng đã kết thúc, không thể chia đội hay đổi chỗ nữa.
                  </p>
                ) : (
                  !can(role, 'split') && (
                    <p className="mb-3 rounded-btn bg-surface-2/80 px-3 py-2 text-sm text-fg-muted">
                      Chỉ chủ phòng ({room.host.name}) dùng được các công cụ chia đội và random.
                    </p>
                  )
                )}
                <ul className="flex flex-col gap-3">
                  {TOOLS.map(({ icon: Icon, title, desc, split }) => (
                    <li key={title}>
                      <button
                        type="button"
                        disabled={busy || finished || !can(role, split ? 'split' : 'random')}
                        onClick={() => actions.tool(title, split)}
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
              <RoomConfigSection
                room={room}
                role={role}
                playerCount={playerCount}
                config={config}
                pending={configPending}
                onUpdate={onUpdateConfig}
              />
            ) : (
              <EmptyState
                className="min-h-60"
                icon={<MessageSquareText size={28} />}
                title="Chưa có ghi chú"
                description={
                  role === 'host'
                    ? 'Ghi chú luật riêng của phòng (cấm tướng, giờ bắt đầu…) sẽ có ở bản sau.'
                    : 'Chủ phòng chưa thêm ghi chú nào.'
                }
              />
            )}
          </div>
        </section>

        {chat('md:col-span-2 xl:col-start-1 xl:row-start-2')}
      </div>
    </div>
  )
}

function RoleBadge({ role, outsider }: { role: RoomRole; outsider?: boolean }) {
  const Icon = role === 'host' ? Crown : role === 'player' ? UserRound : Eye
  return (
    <Badge tone={role === 'host' ? 'gold-outline' : 'neutral'} icon={<Icon size={14} aria-hidden />} className="py-1 text-sm">
      {outsider ? 'Bạn chưa vào phòng' : `Bạn là ${ROOM_ROLE_LABEL[role].toLowerCase()}`}
    </Badge>
  )
}

const LANES: Lane[] = ['TOP', 'JG', 'MID', 'AD', 'SP']

/** (api) Chọn lane và bấm sẵn sàng cho chính mình */
function MySlot({
  me,
  laneUnset,
  busy,
  onLane,
  onReady,
}: {
  me: RoomMember
  laneUnset: boolean
  busy: boolean
  onLane: (lane: Lane) => void
  onReady: () => void
}) {
  return (
    <section aria-labelledby="my-slot-title" className="mb-4 rounded-btn border border-line bg-surface-2/60 p-3">
      <h3 id="my-slot-title" className="text-sm font-semibold">
        Vị trí của bạn
      </h3>
      <div role="group" aria-label="Chọn lane" className="mt-2 flex flex-wrap gap-2">
        {LANES.map((lane) => {
          const Icon = LANE_ICON[lane]
          const active = !laneUnset && me.lane === lane
          return (
            <button
              key={lane}
              type="button"
              aria-pressed={active}
              title={LANE_NAME[lane]}
              disabled={busy}
              onClick={() => !active && onLane(lane)}
              className={cn(
                'inline-flex h-10 min-w-16 items-center justify-center gap-2 rounded-btn border px-2 text-sm font-medium transition-colors disabled:opacity-60',
                active ? 'border-gold/60 bg-gold-tint text-gold' : 'border-line bg-surface-3 text-fg hover:border-gold/35',
              )}
            >
              <Icon size={16} aria-hidden />
              {lane}
              <span className="sr-only">({LANE_NAME[lane]})</span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={me.ready ? 'outline' : 'gold-outline'}
          leftIcon={me.ready ? <X size={16} aria-hidden /> : <Check size={16} aria-hidden />}
          disabled={busy}
          onClick={onReady}
        >
          {me.ready ? 'Huỷ sẵn sàng' : 'Sẵn sàng'}
        </Button>
        <span className="text-xs text-fg-muted">{me.ready ? 'Bạn đã sẵn sàng.' : 'Bấm khi đã chọn lane và sẵn sàng vào trận.'}</span>
      </div>
    </section>
  )
}

/** (api, chủ phòng) Ghi kết quả trận: chỉ khi đủ người và chưa có kết quả (API.md 9.4) */
function MatchResult({
  result,
  finished,
  full,
  busy,
  onSubmit,
}: {
  result: Side | null
  finished: boolean
  full: boolean
  busy: boolean
  onSubmit: (winner: Side) => void
}) {
  return (
    <section aria-labelledby="match-result-title" className="mb-4 rounded-btn border border-line bg-surface-2/60 p-3">
      <h3 id="match-result-title" className="flex items-center gap-2 text-sm font-semibold">
        <Trophy size={16} aria-hidden className="text-gold" />
        Kết quả trận
      </h3>
      {result ? (
        <p className="mt-2 text-sm">
          <span className="font-semibold">{TEAM_NAME[result]}</span> thắng.
        </p>
      ) : finished ? (
        <p className="mt-2 text-sm text-fg-muted">Phòng đã kết thúc, không có kết quả.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['blue', 'red'] as const).map((side) => (
              <Button key={side} size="sm" variant="outline" disabled={busy || !full} onClick={() => onSubmit(side)}>
                {TEAM_NAME[side]} thắng
              </Button>
            ))}
          </div>
          {!full && <p className="mt-2 text-xs text-fg-muted">Cần đủ người chơi ở hai đội mới ghi được kết quả.</p>}
        </>
      )}
    </section>
  )
}

/* ---------------- Đội ---------------- */

const DRAG_TYPE = 'text/x-customaov-player'

function TeamPanel({
  side,
  members,
  capacity,
  editable,
  canKick,
  hostId,
  unsetLanes,
  onMove,
  onKick,
  onInvite,
}: {
  side: Side
  members: RoomMember[]
  capacity: number
  editable: boolean
  canKick: boolean
  hostId: string
  unsetLanes?: ReadonlySet<string>
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
            canKick={canKick}
            laneUnset={unsetLanes?.has(mem.player.id) ?? false}
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
  canKick,
  laneUnset,
  isHost,
  onMove,
  onKick,
}: {
  member: RoomMember
  side: Side
  first: boolean
  editable: boolean
  canKick: boolean
  laneUnset: boolean
  isHost: boolean
  onMove: (playerId: string, to: Side) => void
  onKick: (m: RoomMember) => void
}) {
  const LaneIcon = laneUnset ? UserRound : LANE_ICON[member.lane]
  const laneName = laneUnset ? 'Chưa chọn lane' : LANE_NAME[member.lane]
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
        title={laneName}
        className={cn(
          'inline-flex h-8 min-w-16 shrink-0 items-center justify-center gap-2 rounded-btn bg-lane-chip px-2 text-sm font-medium ring-1 ring-white/5',
          laneUnset && 'text-fg-muted',
        )}
      >
        <LaneIcon size={16} aria-hidden className="text-fg/80" />
        {laneUnset ? '—' : member.lane}
        <span className="sr-only">({laneName})</span>
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
      {editable && <MemberMenu member={member} side={side} isHost={isHost} canKick={canKick} onMove={onMove} onKick={onKick} />}
    </li>
  )
}

/** Menu thay thế cho kéo thả (bàn phím / màn cảm ứng): đổi đội, mời ra khỏi phòng */
function MemberMenu({
  member,
  side,
  isHost,
  canKick,
  onMove,
  onKick,
}: {
  member: RoomMember
  side: Side
  isHost: boolean
  canKick: boolean
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
          {canKick && (
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
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- Cấu hình (tóm tắt + bảng quyền) ---------------- */

function RoomConfigSection({
  room,
  role,
  playerCount,
  config,
  pending,
  onUpdate,
}: {
  room: Room
  role: RoomRole
  playerCount: number
  config: RoomConfigData | null
  pending: boolean
  onUpdate?: (next: RoomConfigEditable) => void | Promise<void>
}) {
  const roles: RoomRole[] = ['host', 'player', 'spectator']
  return (
    <div className="flex flex-col gap-4">
      <RoomConfigPanel
        config={config}
        configPersisted
        isHost={role === 'host'}
        playerCount={playerCount}
        capacity={room.capacity}
        roomStatus={room.status === 'finished' ? 'CLOSED' : 'OPEN'}
        fallbackTitle={room.title}
        headingAs="h2"
        pending={pending}
        onUpdate={onUpdate}
      />
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

/** Chat mock: tin gửi chỉ thêm vào state cục bộ */
function MockRoomChat({ room, canChat, className }: { room: Room; canChat: boolean; className?: string }) {
  const load = useRoomMessages(room.id)
  const [messages, setMessages] = useState<ChatMessage[]>(load.data)

  useEffect(() => {
    if (load.status === 'ready') setMessages(load.data)
  }, [load.status, load.data])

  return (
    <RoomChat
      className={className}
      status={load.status}
      onRetry={load.retry}
      messages={messages}
      meId={currentUser.id}
      composer={canChat ? 'enabled' : 'disabled'}
      onSend={(text) => {
        setMessages((list) => [...list, { id: `local-${list.length}-${Date.now()}`, author: currentUser, text, time: nowHHMM() }])
        return true
      }}
    />
  )
}

function RoomChat({
  status,
  onRetry,
  messages,
  meId,
  composer,
  composerNote,
  locked,
  onSend,
  className,
}: {
  status: 'loading' | 'error' | 'ready'
  onRetry: () => void
  messages: ChatMessage[]
  meId?: string
  /** `disabled`: ô nhập hiện nhưng khoá (mock); `hidden`: không hiện ô gửi (api, khán giả) */
  composer: 'enabled' | 'disabled' | 'hidden'
  composerNote?: string
  /** Không đủ quyền đọc chat: thay danh sách bằng thông báo này */
  locked?: string
  /** Trả về `true` khi gửi được (xoá ô nhập). Có thể bất đồng bộ (api). */
  onSend: (text: string) => boolean | Promise<boolean>
  className?: string
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  const canChat = composer === 'enabled'

  // Tin mới → cuộn xuống cuối khung chat (chỉ trong khung, không cuộn cả trang)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const send = () => {
    const text = draft.trim()
    if (!text || sending) return
    const result = onSend(text)
    if (typeof result === 'boolean') {
      if (result) setDraft('')
      return
    }
    setSending(true)
    void result.then((ok) => {
      setSending(false)
      if (ok) setDraft((current) => (current.trim() === text ? '' : current))
    })
  }

  return (
    <section aria-labelledby="room-chat-title" className={cn('flex min-w-0 flex-col rounded-card border border-line bg-surface/90', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="room-chat-title" className="flex items-center gap-3 text-base font-semibold">
          <MessageSquareText size={20} aria-hidden className="text-gold" />
          Chat phòng
        </h2>
        {!locked && <span className="text-xs text-fg-muted tabular">{messages.length} tin nhắn</span>}
      </div>

      {locked ? (
        <p className="flex items-center justify-center gap-2 px-4 py-8 text-center text-sm text-fg-muted">
          <Lock size={16} aria-hidden />
          {locked}
        </p>
      ) : status !== 'ready' ? (
        <ListStatus status={status} onRetry={onRetry} label="tin nhắn" className="m-3" skeleton={<SkeletonRows count={3} className="px-1" />}>
          {null}
        </ListStatus>
      ) : messages.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-fg-muted">Chưa có tin nhắn nào. Hãy chào mọi người trong phòng!</p>
      ) : (
        <ol ref={listRef} role="log" aria-label="Tin nhắn trong phòng" className="relative flex max-h-80 flex-col gap-3 overflow-y-auto px-4 py-3">
          {messages.map((m) => {
            const mine = !m.system && !!meId && m.author.id === meId
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

      {composer === 'hidden' ? (
        composerNote && <p className="mt-auto border-t border-line px-4 py-3 text-sm text-fg-muted">{composerNote}</p>
      ) : (
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
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={canChat ? 'Nhập tin nhắn…' : 'Chỉ người trong phòng mới gửi được tin nhắn'}
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg-muted disabled:cursor-not-allowed"
            />
            <IconButton label="Gửi tin nhắn" type="submit" variant="ghost" className="size-10" disabled={!canChat || sending || !draft.trim()}>
              <SendHorizontal size={20} aria-hidden />
            </IconButton>
          </div>
        </form>
      )}
    </section>
  )
}
