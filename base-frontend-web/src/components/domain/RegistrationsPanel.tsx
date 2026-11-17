import { useId, useState, type FormEvent } from 'react'
import { Check, ClipboardList, X } from 'lucide-react'
import { ApiError, registrationActions, useRegistrations, type Registration } from '../../api'
import { useToast } from '../../context/AppContext'
import { Button } from '../ui/Button'
import { ListStatus, SkeletonRows } from '../ui/ListStatus'
import { Card, SectionTitle } from '../ui/primitives'

const errorText = (err: unknown): string =>
  err instanceof ApiError ? err.message || 'Có lỗi xảy ra, vui lòng thử lại.' : 'Không thể kết nối máy chủ, vui lòng thử lại.'

/**
 * Bảng duyệt đăng ký cho BTC (chế độ api): danh sách đơn chờ duyệt kèm Duyệt / Từ chối (lý do tuỳ chọn).
 * Sau mỗi thao tác gọi `onChanged` để trang tải lại chi tiết giải (tiến độ đăng ký, danh sách đội).
 */
export function RegistrationsPanel({
  slug,
  teamCount,
  approvedCount,
  onChanged,
}: {
  slug: string
  teamCount: number
  approvedCount: number
  onChanged: () => Promise<void>
}) {
  const { notify } = useToast()
  const load = useRegistrations(slug)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pending = load.data.filter((r) => r.status === 'pending')
  const full = approvedCount >= teamCount

  const run = async (registration: Registration, action: () => Promise<Registration>, message: string) => {
    setBusyId(registration.id)
    setError(null)
    try {
      await action()
      setRejectingId(null)
      notify(message, `Đội ${registration.teamName}`)
      await Promise.all([load.refresh(), onChanged()])
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="p-4 md:p-6">
      <SectionTitle
        icon={<ClipboardList size={20} />}
        title="Duyệt đăng ký"
        action={
          <span className="text-sm text-fg-muted tabular">
            Đã duyệt {approvedCount}/{teamCount}
          </span>
        }
      />
      {error && (
        <div role="alert" className="mt-3 rounded-btn border border-danger/40 bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
      {full && pending.length > 0 && (
        <p className="mt-3 text-sm text-fg-muted">Giải đã đủ đội. Chỉ có thể từ chối các đơn còn lại.</p>
      )}
      <ListStatus
        status={load.status}
        onRetry={load.retry}
        label="đơn đăng ký"
        className="mt-4"
        skeleton={<SkeletonRows count={2} />}
      >
        {pending.length === 0 ? (
          <p className="rounded-btn bg-surface-2/60 px-3 py-4 text-center text-sm text-fg-muted">Không có đơn nào chờ duyệt.</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Đơn chờ duyệt">
            {pending.map((r) => (
              <PendingItem
                key={r.id}
                registration={r}
                busy={busyId === r.id}
                disabled={busyId !== null}
                canApprove={!full}
                rejecting={rejectingId === r.id}
                onApprove={() =>
                  run(r, () => registrationActions.approve(slug, r.id), 'Đã duyệt đội')
                }
                onStartReject={() => setRejectingId(r.id)}
                onCancelReject={() => setRejectingId(null)}
                onReject={(reason) =>
                  run(r, () => registrationActions.reject(slug, r.id, reason ? { reason } : {}), 'Đã từ chối đội')
                }
              />
            ))}
          </ul>
        )}
      </ListStatus>
    </Card>
  )
}

function PendingItem({
  registration: r,
  busy,
  disabled,
  canApprove,
  rejecting,
  onApprove,
  onStartReject,
  onCancelReject,
  onReject,
}: {
  registration: Registration
  busy: boolean
  disabled: boolean
  canApprove: boolean
  rejecting: boolean
  onApprove: () => void
  onStartReject: () => void
  onCancelReject: () => void
  onReject: (reason: string) => void
}) {
  const uid = useId()
  const [reason, setReason] = useState('')
  const submitReject = (e: FormEvent) => {
    e.preventDefault()
    onReject(reason.trim())
  }

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-btn border border-line bg-surface-2/60 p-4" aria-label={`Đơn của đội ${r.teamName}`}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold break-words">{r.teamName}</p>
          <p className="mt-1 text-sm break-words text-fg-muted">
            {r.members.map((m) => m.displayName).join(', ')}
            {r.subs.length > 0 && <> · Dự bị: {r.subs.map((m) => m.displayName).join(', ')}</>}
          </p>
        </div>
        {!rejecting && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Check size={16} aria-hidden />}
              disabled={disabled || !canApprove}
              onClick={onApprove}
              aria-label={`Duyệt đội ${r.teamName}`}
            >
              {busy ? 'Đang duyệt…' : 'Duyệt'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<X size={16} aria-hidden />}
              disabled={disabled}
              onClick={onStartReject}
              aria-label={`Từ chối đội ${r.teamName}`}
            >
              Từ chối
            </Button>
          </div>
        )}
      </div>
      {rejecting && (
        <form onSubmit={submitReject} className="flex flex-col gap-2" aria-label={`Từ chối đội ${r.teamName}`}>
          <label htmlFor={`${uid}-reason`} className="text-sm font-medium">
            Lý do từ chối <span className="font-normal text-fg-muted">(không bắt buộc)</span>
          </label>
          <div className="flex h-10 items-center rounded-btn border border-line-strong bg-black/25 px-3 focus-within:border-gold/70">
            <input
              id={`${uid}-reason`}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="vd: Thiếu thông tin liên hệ"
              className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onCancelReject} disabled={busy}>
              Huỷ
            </Button>
            <Button type="submit" variant="outline" size="sm" disabled={busy}>
              {busy ? 'Đang gửi…' : 'Xác nhận từ chối'}
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}
