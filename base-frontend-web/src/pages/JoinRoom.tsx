import { useId, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { joinOpenRoom } from '../api'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/primitives'
import { useAuth, useToast } from '../context/AppContext'

const DISPLAY_NAME_MAX = 40

export default function JoinRoom() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { notify } = useToast()
  const inputId = useId()

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    const trimmed = displayName.trim()
    if (!trimmed || trimmed.length > DISPLAY_NAME_MAX) {
      setError('Vui lòng nhập tên hiển thị (1–40 ký tự).')
      return
    }
    setPending(true)
    setError(null)
    const result = await joinOpenRoom(inviteCode ?? '', trimmed)
    setPending(false)
    if (result.ok) {
      navigate(`/rooms/${result.data.room_id}`, { replace: true })
      return
    }
    setError(result.error.message)
    notify(result.error.message)
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="Tham gia phòng mở"
        description={inviteCode ? `Mã mời: ${inviteCode}` : 'Nhập tên hiển thị để vào hàng chờ.'}
      />
      <Card className="mt-6 max-w-lg min-w-0 p-6">
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
        </form>
      </Card>
    </div>
  )
}
