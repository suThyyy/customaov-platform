import { useCallback, useMemo, useRef, useState } from 'react'
import { Radio, UsersRound } from 'lucide-react'
import {
  openRoomPermissions,
  useOpenRoom,
  useOpenRoomActions,
  type OpenRoomPending,
  type OpenRoomSnapshot,
  type RoomConfig,
  type RoomMutationResult,
} from '../../api'
import { useAuth, useToast } from '../../context/AppContext'
import { ButtonLink } from '../ui/Button'
import { ListStatus, SkeletonRows } from '../ui/ListStatus'
import { Badge } from '../ui/primitives'
import { EmptyState } from './EmptyState'
import { ConfirmActionModal, type ConfirmRequest } from './open-room/ConfirmActionModal'
import { OPEN_ROOM_PHASE_LABEL } from './open-room/helpers'
import { OpenRoomControls } from './open-room/OpenRoomControls'
import { OpenRoomLineup } from './open-room/OpenRoomLineup'
import { OpenRoomQueue } from './open-room/OpenRoomQueue'
import { RoomConfigPanel } from './RoomConfigPanel'
import { configFromRoom, updateConfiguredRoom } from '../../api/supabase/configuration'
import { SeriesPanel } from './open-room/SeriesPanel'
import { PublicRoomAccess } from './open-room/PublicRoomAccess'
import { prepareNextOpenRoomRound } from '../../api/supabase/roomMutations'

export type OpenRoomActions = ReturnType<typeof useOpenRoomActions>

const IDLE_PENDING: OpenRoomPending = {
  close: false,
  leave: false,
  addPlayer: false,
  kick: false,
  requeue: false,
  continueQueue: false,
  prepare: false,
  saveLineup: false,
  replace: false,
  start: false,
  end: false,
}

const noopResult = async () => ({ ok: true, data: null }) as RoomMutationResult<never>

const IDLE_ACTIONS: OpenRoomActions = {
  pending: IDLE_PENDING,
  close: noopResult,
  leave: noopResult,
  addPlayer: noopResult,
  kick: noopResult,
  requeue: noopResult,
  continueQueue: noopResult,
  prepare: noopResult,
  saveLineup: noopResult,
  replace: noopResult,
  swap: noopResult,
  start: noopResult,
  end: noopResult,
}

export function SupabaseRoomView({ roomId }: { roomId: string | undefined }) {
  const room = useOpenRoom(roomId)
  const actions = useOpenRoomActions(roomId ?? '', room.snapshot)
  const { user } = useAuth()
  const { notify } = useToast()
  if (roomId && (room.status === 'error' || room.status === 'ready' && !room.snapshot)) return <PublicRoomAccess key={roomId} roomId={roomId} />

  if (room.status !== 'ready') {
    return (
      <ListStatus status={room.status} onRetry={room.retry} label="phòng" className="mt-6" skeleton={<SkeletonRows count={5} />}>
        {null}
      </ListStatus>
    )
  }
  if (!room.snapshot) {
    return (
      <EmptyState
        as="h1"
        className="mt-6 min-h-96"
        icon={<UsersRound size={32} />}
        title="Không thể mở phòng"
        description="Phòng không tồn tại hoặc tài khoản của bạn không có quyền xem phòng này."
        action={<ButtonLink to="/dashboard" variant="outline">Về trang chủ</ButtonLink>}
      />
    )
  }
  return (
    <SupabaseRoomSnapshot
      snapshot={room.snapshot}
      connection={room.connection}
      userId={user?.id}
      actions={actions}
      onNotify={notify}
      roomConfig={configFromRoom(room.snapshot.room)}
      configPersisted={Boolean(room.snapshot.room.best_of)}
    />
  )
}

export function SupabaseRoomSnapshot({
  snapshot,
  connection,
  userId,
  actions = IDLE_ACTIONS,
  onNotify = () => {},
  roomConfig = null,
  configPersisted = false,
}: {
  snapshot: OpenRoomSnapshot
  connection: 'connecting' | 'live' | 'reconnecting' | 'offline'
  userId?: string | null
  actions?: OpenRoomActions
  onNotify?: (title: string, description?: string) => void
  roomConfig?: RoomConfig | null
  configPersisted?: boolean
}) {
  const live = connection === 'live'
  const permissions = useMemo(() => openRoomPermissions(snapshot, userId), [snapshot, userId])
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const closeConfirm = useCallback(() => setConfirm(null), [])
  const [configPending, setConfigPending] = useState(false)
  const configBusy = useRef(false)

  const runAction = useCallback(async <T,>(fn: () => Promise<RoomMutationResult<T>>): Promise<boolean> => {
    const result = await fn()
    if (!result.ok) {
      onNotify(result.error.message)
      return false
    }
    return true
  }, [onNotify])

  const handleConfirm = async (request: ConfirmRequest) => {
    if (request.kind === 'kick') await runAction(() => actions.kick(request.memberId))
    else if (request.kind === 'requeue') await runAction(() => actions.requeue(request.memberId))
    else if (request.kind === 'leave') await runAction(() => actions.leave())
    else if (request.kind === 'close') await runAction(() => actions.close())
    setConfirm(null)
  }

  const confirmPending = confirm
    ? actions.pending[confirm.kind]
    : false

  return (
    <div className="mt-6 flex min-w-0 flex-col gap-6">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-fg-muted">Open Room</p>
          <h1 className="break-words text-2xl font-bold md:text-4xl">{snapshot.room.room_name ?? `Phòng #${snapshot.room.invite_code}`}</h1>
          <p className="mt-2 text-sm text-fg-muted">
            Vòng {snapshot.room.current_round_no} · {OPEN_ROOM_PHASE_LABEL[snapshot.room.current_round_state]} · phiên bản {snapshot.version}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={snapshot.room.status === 'open' ? 'success' : 'neutral'}>
            {snapshot.room.status === 'open' ? 'Đang mở' : 'Đã đóng'}
          </Badge>
          <Badge tone={live ? 'success' : 'danger'} icon={<Radio size={14} aria-hidden />}>
            {live ? 'Đang cập nhật trực tiếp' : 'Mất kết nối, đang thử lại'}
          </Badge>
        </div>
      </header>

      <RoomConfigPanel
        config={roomConfig}
        configPersisted={configPersisted}
        isHost={permissions.role === 'host'}
        playerCount={snapshot.selected.length}
        roomStatus={snapshot.room.status === 'open' ? 'OPEN' : 'CLOSED'}
        headingAs="h2"
        pending={configPending}
        styleLocked={snapshot.room.status !== 'open' || snapshot.room.current_round_state === 'active'}
        allocationLocked={snapshot.room.status !== 'open' || snapshot.room.current_round_state === 'active' || snapshot.selected.some(player => player.team)}
        onUpdate={async editable => {
          if (configBusy.current) return
          configBusy.current = true
          setConfigPending(true)
          try { await updateConfiguredRoom(snapshot.room.id, editable, snapshot.version) }
          catch (error) { onNotify(error instanceof Error ? error.message : String(error)) }
          finally { configBusy.current = false; setConfigPending(false) }
        }}
      />

      <OpenRoomControls
        snapshot={snapshot}
        permissions={permissions}
        pending={actions.pending}
        onPrepare={() => void runAction(() => actions.prepare())}
        onStart={() => void runAction(() => actions.start())}
        onEnd={() => void runAction(() => actions.end())}
        onContinueQueue={() => void runAction(() => actions.continueQueue())}
        onRequestLeave={() => setConfirm({ kind: 'leave' })}
        onRequestClose={() => setConfirm({ kind: 'close' })}
        onNotify={onNotify}
      />

      <OpenRoomLineup
        snapshot={snapshot}
        permissions={permissions}
        pending={actions.pending}
        splitTool={roomConfig?.splitTool ?? 'random'}
        onSaveLineup={(players) => runAction(() => actions.saveLineup(players))}
        onSwap={(first, second) => runAction(() => actions.swap(first, second))}
        onKick={(memberId, displayName) => setConfirm({ kind: 'kick', memberId, displayName })}
        onRequeue={(memberId, displayName) => setConfirm({ kind: 'requeue', memberId, displayName })}
        onReplace={(memberId) => void runAction(() => actions.replace(memberId))}
        onNotify={onNotify}
      />

      {snapshot.room.best_of && <SeriesPanel
        snapshot={snapshot}
        isHost={permissions.role === 'host'}
        canPrepareNext={permissions.prepare}
        onPrepareNext={() => prepareNextOpenRoomRound(snapshot.room.id)}
        notify={onNotify}
      />}

      <OpenRoomQueue
        snapshot={snapshot}
        permissions={permissions}
        pending={actions.pending}
        onAddPlayer={(displayName) => runAction(() => actions.addPlayer(displayName))}
        onKick={(memberId, displayName) => setConfirm({ kind: 'kick', memberId, displayName })}
        onRequeue={(memberId, displayName) => setConfirm({ kind: 'requeue', memberId, displayName })}
        onReplace={(memberId) => void runAction(() => actions.replace(memberId))}
      />

      <ConfirmActionModal
        request={confirm}
        pending={confirmPending}
        onClose={closeConfirm}
        onConfirm={(req) => void handleConfirm(req)}
      />
    </div>
  )
}
