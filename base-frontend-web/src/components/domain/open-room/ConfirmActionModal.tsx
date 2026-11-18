import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'

export type ConfirmRequest =
  | { kind: 'kick'; memberId: string; displayName: string }
  | { kind: 'requeue'; memberId: string; displayName: string }
  | { kind: 'leave' }
  | { kind: 'close' }

const COPY: Record<ConfirmRequest['kind'], { title: string; confirmLabel: string; pendingLabel: string }> = {
  kick: { title: 'Mời người chơi ra khỏi phòng?', confirmLabel: 'Mời ra khỏi phòng', pendingLabel: 'Đang mời ra…' },
  requeue: { title: 'Đưa về cuối hàng chờ?', confirmLabel: 'Đưa về cuối hàng chờ', pendingLabel: 'Đang đưa vào hàng chờ…' },
  leave: { title: 'Rời khỏi phòng?', confirmLabel: 'Rời phòng', pendingLabel: 'Đang rời phòng…' },
  close: { title: 'Đóng phòng mở?', confirmLabel: 'Đóng phòng', pendingLabel: 'Đang đóng phòng…' },
}

function descriptionOf(request: ConfirmRequest): string {
  switch (request.kind) {
    case 'kick':
      return `Người chơi "${request.displayName}" sẽ bị mời ra khỏi phòng và không còn trong hàng chờ.`
    case 'requeue':
      return `Người chơi "${request.displayName}" sẽ được đưa về cuối hàng chờ FIFO.`
    case 'leave':
      return 'Bạn sẽ rời khỏi phòng và hàng chờ hiện tại.'
    case 'close':
      return 'Phòng sẽ đóng vĩnh viễn và không thể tiếp tục vòng mới.'
  }
}

export function ConfirmActionModal({
  request,
  pending,
  onClose,
  onConfirm,
}: {
  request: ConfirmRequest | null
  pending: boolean
  onClose: () => void
  onConfirm: (request: ConfirmRequest) => void
}) {
  const copy = request ? COPY[request.kind] : null
  return (
    <Modal open={request !== null} onClose={onClose} title={copy?.title ?? ''}>
      {request && copy && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg-muted">{descriptionOf(request)}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={pending} onClick={onClose}>
              Hủy
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              className={request.kind === 'kick' || request.kind === 'close' ? 'border-danger/50 text-danger hover:bg-danger-bg' : undefined}
              onClick={() => onConfirm(request)}
            >
              {pending ? copy.pendingLabel : copy.confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
