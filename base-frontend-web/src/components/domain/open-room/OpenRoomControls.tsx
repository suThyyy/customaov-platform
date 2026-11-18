import { Copy, DoorOpen, Play, Power, Square, UserPlus } from 'lucide-react'
import type { OpenRoomPending, OpenRoomPermissions, OpenRoomSnapshot } from '../../../api'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/primitives'
import { OPEN_ROOM_PHASE_LABEL } from './helpers'

export function OpenRoomControls({
  snapshot,
  permissions,
  pending,
  onPrepare,
  onStart,
  onEnd,
  onContinueQueue,
  onRequestLeave,
  onRequestClose,
  onNotify,
}: {
  snapshot: OpenRoomSnapshot
  permissions: OpenRoomPermissions
  pending: OpenRoomPending
  onPrepare: () => void
  onStart: () => void
  onEnd: () => void
  onContinueQueue: () => void
  onRequestLeave: () => void
  onRequestClose: () => void
  onNotify: (title: string, description?: string) => void
}) {
  const phase = snapshot.room.current_round_state
  const invitePath = `/join/${snapshot.room.invite_code}`
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}${invitePath}` : invitePath

  const copyInviteLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl)
        onNotify('Đã sao chép link mời', inviteUrl)
        return
      }
    } catch {
      // Bỏ qua lỗi clipboard ở môi trường không hỗ trợ
    }
    onNotify('Không thể tự động sao chép', inviteUrl)
  }

  return (
    <Card className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wider text-fg-muted uppercase">Điều khiển vòng</p>
          <p className="mt-1 text-base font-semibold">
            Vòng {snapshot.room.current_round_no} · {OPEN_ROOM_PHASE_LABEL[phase]}
          </p>
          <p className="mt-1 text-xs text-fg-muted">Lưu kết quả trận: sắp có</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {permissions.prepare && (
            <Button variant="primary" size="md" disabled={pending.prepare} onClick={onPrepare}>
              {pending.prepare
                ? phase === 'ended' ? 'Đang tạo vòng…' : 'Đang chuẩn bị…'
                : phase === 'ended' ? 'Vòng tiếp theo' : 'Chuẩn bị vòng'}
            </Button>
          )}
          {permissions.start && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Play size={16} aria-hidden />}
              disabled={pending.start}
              onClick={onStart}
            >
              {pending.start ? 'Đang bắt đầu…' : 'Bắt đầu'}
            </Button>
          )}
          {permissions.end && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Square size={16} aria-hidden />}
              disabled={pending.end}
              onClick={onEnd}
            >
              {pending.end ? 'Đang kết thúc…' : 'Kết thúc'}
            </Button>
          )}

          {(permissions.role === 'member' || permissions.continueQueue) && (
            <Button
              variant="outline"
              size="md"
              leftIcon={<UserPlus size={16} aria-hidden />}
              disabled={!permissions.continueQueue || pending.continueQueue}
              onClick={onContinueQueue}
            >
              {pending.continueQueue ? 'Đang vào hàng chờ…' : 'Vào hàng chờ'}
            </Button>
          )}

          {permissions.leave && (
            <Button
              variant="outline"
              size="md"
              leftIcon={<DoorOpen size={16} aria-hidden />}
              disabled={pending.leave}
              onClick={onRequestLeave}
            >
              {pending.leave ? 'Đang rời phòng…' : 'Rời phòng'}
            </Button>
          )}

          {permissions.close && (
            <Button
              variant="outline"
              size="md"
              leftIcon={<Power size={16} aria-hidden />}
              disabled={pending.close}
              onClick={onRequestClose}
            >
              {pending.close ? 'Đang đóng phòng…' : 'Đóng phòng'}
            </Button>
          )}
        </div>
      </div>

      {permissions.role === 'host' && (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-btn border border-line bg-surface-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-fg-muted">Link mời vào phòng</p>
            <p className="truncate text-sm font-medium">{inviteUrl}</p>
          </div>
          <Button variant="outline" size="sm" leftIcon={<Copy size={14} aria-hidden />} onClick={copyInviteLink}>
            Sao chép link mời
          </Button>
        </div>
      )}
    </Card>
  )
}
