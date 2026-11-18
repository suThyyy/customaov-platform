import { Radio, UsersRound } from 'lucide-react'
import { useOpenRoom, type OpenRoomSnapshot } from '../../api'
import { ButtonLink } from '../ui/Button'
import { ListStatus, SkeletonRows } from '../ui/ListStatus'
import { Badge, Card } from '../ui/primitives'
import { EmptyState } from './EmptyState'

export function SupabaseRoomView({ roomId }: { roomId: string | undefined }) {
  const room = useOpenRoom(roomId)
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
  return <SupabaseRoomSnapshot snapshot={room.snapshot} connection={room.connection} />
}

export function SupabaseRoomSnapshot({
  snapshot,
  connection,
}: {
  snapshot: OpenRoomSnapshot
  connection: 'connecting' | 'live' | 'reconnecting' | 'offline'
}) {
  const live = connection === 'live'
  return (
    <div className="mt-6 flex min-w-0 flex-col gap-6">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-fg-muted">Open Room</p>
          <h1 className="text-2xl font-bold md:text-4xl">Phòng #{snapshot.room.invite_code}</h1>
          <p className="mt-2 text-sm text-fg-muted">Vòng {snapshot.room.current_round_no} · phiên bản {snapshot.version}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={snapshot.room.status === 'open' ? 'success' : 'neutral'}>{snapshot.room.status === 'open' ? 'Đang mở' : 'Đã đóng'}</Badge>
          <Badge tone={live ? 'success' : 'danger'} icon={<Radio size={14} aria-hidden />}>
            {live ? 'Đang cập nhật trực tiếp' : 'Mất kết nối, đang thử lại'}
          </Badge>
        </div>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-4">
          <h2 className="text-lg font-semibold">Đang chờ ({snapshot.waiting.length})</h2>
          {snapshot.waiting.length ? (
            <ol className="mt-3 flex flex-col gap-2">
              {snapshot.waiting.map((player, index) => (
                <li key={player.memberId} className="flex min-w-0 items-center gap-3 rounded-btn border border-line bg-surface-2 p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-4 text-sm tabular">{index + 1}</span>
                  <span className="min-w-0 font-medium">{player.displayName}</span>
                  <span className="ml-auto text-xs text-fg-muted tabular">FIFO #{player.queueSeq}</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-sm text-fg-muted">Hàng chờ đang trống.</p>}
        </Card>

        <Card className="min-w-0 p-4">
          <h2 className="text-lg font-semibold">Được chọn ({snapshot.selected.length})</h2>
          {snapshot.selected.length ? (
            <div className="relative mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="text-fg-muted"><tr><th className="p-2">Slot</th><th className="p-2">Người chơi</th><th className="p-2">Đội</th><th className="p-2">Trạng thái</th></tr></thead>
                <tbody>{snapshot.selected.map((player) => (
                  <tr key={player.memberId} className="border-t border-line">
                    <td className="p-2 tabular">{player.slot}</td><td className="p-2 font-medium">{player.displayName}</td>
                    <td className="p-2">{player.team ? player.team.toUpperCase() : '—'}</td><td className="p-2">{player.readyState === 'ready' ? 'Sẵn sàng' : 'Đang chờ'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="mt-3 text-sm text-fg-muted">Chưa có người chơi được chọn.</p>}
        </Card>
      </div>
      <p className="text-center text-sm text-fg-muted">Thao tác phòng sẽ có ở bản sau.</p>
    </div>
  )
}
