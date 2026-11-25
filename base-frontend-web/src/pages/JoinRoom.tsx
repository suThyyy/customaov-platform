import { useId, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { joinOpenRoom } from '../api'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/primitives'
import { useAuth, useToast } from '../context/AppContext'

const DISPLAY_NAME_MAX = 40

export default function JoinRoom() {
  const { inviteCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { notify } = useToast()
  const inputId = useId()
  const pendingRef = useRef(false)
  const stateInviteCode = (location.state as { inviteCode?: unknown } | null)?.inviteCode
  const effectiveInviteCode = typeof stateInviteCode === 'string' ? stateInviteCode.trim() : inviteCode === 'discovery' ? '' : inviteCode ?? ''
  const inviteFromDiscovery = typeof stateInviteCode === 'string'

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pendingRef.current || pending) return
    if (!effectiveInviteCode) {
      setError('Thiếu lời mời. Hãy quay lại danh sách phòng công khai và chọn tham gia lại.')
      return
    }
    const trimmed = displayName.trim()
    if (!trimmed || trimmed.length > DISPLAY_NAME_MAX) {
      setError('Vui lòng nhập tên hiển thị (1–40 ký tự).')
      return
    }
    pendingRef.current = true
    setPending(true)
    setError(null)
    try {
      const result = await joinOpenRoom(effectiveInviteCode, trimmed)
      if (result.ok) {
        navigate(`/rooms/${result.data.room_id}`, { replace: true, state: null })
        notify('Đã tham gia phòng', 'Đang xác nhận vị trí của bạn từ hàng chờ hiện tại.')
        return
      }
      const message = result.error.message.split(effectiveInviteCode).join('[ẩn]')
      setError(message)
      notify(message)
    } catch (reason) {
      const rawMessage = reason instanceof Error ? reason.message : 'Không thể tham gia phòng lúc này.'
      const message = effectiveInviteCode ? rawMessage.split(effectiveInviteCode).join('[ẩn]') : rawMessage
      setError(message)
      notify(message)
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="Tham gia phòng mở"
        description={inviteFromDiscovery ? 'Nhập tên hiển thị để gửi yêu cầu tham gia phòng công khai.' : inviteCode ? `Mã mời: ${inviteCode}` : 'Nhập tên hiển thị để vào hàng chờ.'}
      />
      <Card className="mt-6 max-w-lg min-w-0 p-6">
        {!effectiveInviteCode ? <section className="space-y-4"><p role="alert">Không tìm thấy lời mời. Vui lòng chọn phòng hoặc mở lại liên kết mời hợp lệ.</p><ButtonLink to="/dashboard#rooms" variant="outline">Chọn phòng</ButtonLink></section> :
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor={inputId} className="text-sm font-medium text-fg">
              Tên hiển thị
            </label>
            <input
              id={inputId}
              type="text"
              maxLength={DISPLAY_NAME_MAX}
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value)
                if (error) setError(null)
              }}
              placeholder="Nhập tên hiển thị trong phòng"
              className="h-10 w-full rounded-btn border border-line-strong bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-gold focus:outline-none"
            />
            <p className="text-xs text-fg-muted">Tối đa {DISPLAY_NAME_MAX} ký tự.</p>
          </div>
          {error && (
            <p role="alert" className="rounded-btn border border-danger/40 bg-danger-bg px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Đang vào phòng…' : 'Vào phòng'}
            </Button>
            <ButtonLink to="/dashboard" variant="ghost">
              Quay lại
            </ButtonLink>
          </div>
        </form>}
      </Card>
    </div>
  )
}
