import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { CalendarClock, ChevronDown, ClipboardPen, Lock, Shuffle, ShieldCheck } from 'lucide-react'
import { organizerActions, organizerErrorMessage, seriesOf, type ScheduledMatch, type TournamentDetail } from '../../api'
import { useToast } from '../../context/AppContext'
import { cn } from '../../lib/cn'
import { hasScoredMatch, isScheduled, readyMatches } from '../../lib/tournament'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Card, SectionTitle } from '../ui/primitives'
import { ScoreDialog } from './ScoreDialog'

type Confirm = 'close' | 'draw' | null

const fieldClass =
  'mt-2 w-full rounded-btn border border-line-strong bg-surface-2 px-3 py-2 text-base text-fg outline-none transition-colors focus:border-gold/70 focus:ring-2 focus:ring-gold/15'

/**
 * Bảng điều khiển ban tổ chức (chỉ hiện khi `myRole === 'organizer'`, nguồn API).
 * Đóng đăng ký, bốc thăm / bốc lại (có xác nhận), nhập tỉ số và xếp lịch từng trận đủ 2 đội.
 * Mọi nút là nút viền/ghost: nút vàng đặc duy nhất của màn nằm trên banner.
 * Sau mỗi thao tác gọi `onChanged` để tải lại chi tiết giải.
 */
export function OrganizerPanel({
  d,
  onChanged,
  children,
}: {
  d: TournamentDetail
  onChanged: () => Promise<void>
  /** Chỗ gắn phần duyệt đăng ký đội (E5-T03) */
  children?: ReactNode
}) {
  const { notify } = useToast()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [scoring, setScoring] = useState<ScheduledMatch | null>(null)
  const [scheduling, setScheduling] = useState<ScheduledMatch | null>(null)
  const [showMatches, setShowMatches] = useState(true)
  const listId = useId()

  const deadline = d.registrationDeadlineAt ? Date.parse(d.registrationDeadlineAt) : NaN
  const registrationOpen = d.status === 'open' && !(deadline <= Date.now())
  const drawn = d.bracket.length > 0
  const scored = hasScoredMatch(d)
  const canRedraw = d.status !== 'finished' && !scored
  const drawBlocked = registrationOpen
    ? 'Đóng đăng ký trước khi bốc thăm.'
    : d.teamList.length < 2
      ? 'Cần ít nhất 2 đội đã duyệt để bốc thăm.'
      : ''
  const matches = readyMatches(d)
  const series = seriesOf(d)

  const refresh = useCallback(async () => {
    try {
      await onChanged()
    } catch {
      notify('Không tải lại được chi tiết giải', 'Hãy tải lại trang để xem dữ liệu mới nhất.')
    }
  }, [onChanged, notify])

  const closeConfirm = useCallback(() => {
    setConfirm(null)
    setConfirmError('')
  }, [])
  const closeScore = useCallback(() => setScoring(null), [])
  const closeSchedule = useCallback(() => setScheduling(null), [])

  const runConfirm = async () => {
    if (!confirm || busy) return
    setBusy(true)
    setConfirmError('')
    try {
      if (confirm === 'close') {
        await organizerActions.closeRegistration(d.slug)
        notify('Đã đóng đăng ký')
      } else {
        await organizerActions.draw(d.slug)
        notify(drawn ? 'Đã bốc lại nhánh đấu' : 'Đã bốc thăm nhánh đấu')
      }
      setConfirm(null)
      await refresh()
    } catch (error) {
      setConfirmError(organizerErrorMessage(error, 'Thao tác thất bại. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  const status = registrationOpen
    ? `Đang mở đăng ký · ${d.teamList.length}/${d.teamCount} đội đã duyệt${d.registrationDeadline ? ` · hạn ${d.registrationDeadline}` : ''}`
    : !drawn
      ? `Đã đóng đăng ký · ${d.teamList.length} đội đã duyệt · chưa bốc thăm`
      : d.status === 'finished'
        ? 'Giải đã kết thúc'
        : `Đã bốc thăm · ${matches.filter((m) => m.score).length}/${matches.length} trận đủ đội đã có tỉ số`

  return (
    <Card role="region" className="p-4 md:p-6" aria-labelledby="organizer-title">
      <SectionTitle
        icon={<ShieldCheck size={20} />}
        title={<span id="organizer-title">Bảng điều khiển ban tổ chức</span>}
        action={<span className="hidden shrink-0 text-sm text-fg-muted sm:inline">Chỉ ban tổ chức thấy</span>}
      />
      <p className="mt-2 text-sm text-fg-muted">{status}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {registrationOpen && (
          <Button variant="outline" leftIcon={<Lock size={16} aria-hidden />} onClick={() => setConfirm('close')}>
            Đóng đăng ký
          </Button>
        )}
        {canRedraw && (
          <Button
            variant="gold-outline"
            leftIcon={<Shuffle size={16} aria-hidden />}
            disabled={Boolean(drawBlocked)}
            aria-describedby={drawBlocked ? `${listId}-draw-hint` : undefined}
            onClick={() => setConfirm('draw')}
          >
            {drawn ? 'Bốc lại' : 'Bốc thăm'}
          </Button>
        )}
      </div>
      {canRedraw && drawBlocked && (
        <p id={`${listId}-draw-hint`} className="mt-2 text-sm text-fg-muted">
          {drawBlocked}
        </p>
      )}
      {drawn && scored && d.status !== 'finished' && (
        <p className="mt-2 text-sm text-fg-muted">Không thể bốc lại vì đã có trận được nhập tỉ số.</p>
      )}

      {matches.length > 0 && (
        <section className="mt-6" aria-labelledby={`${listId}-title`}>
          <h3 id={`${listId}-title`}>
            <button
              type="button"
              aria-expanded={showMatches}
              aria-controls={listId}
              onClick={() => setShowMatches((v) => !v)}
              className="flex items-center gap-2 rounded-btn text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              Quản lý trận đấu <span className="font-normal text-fg-muted tabular">({matches.length})</span>
              <ChevronDown size={18} aria-hidden className={cn('transition-transform', showMatches && 'rotate-180')} />
            </button>
          </h3>
          {showMatches && (
            <ul id={listId} className="mt-3 flex flex-col gap-2">
              {matches.map((m) => (
                <li key={m.id} className="flex flex-col gap-3 rounded-btn bg-surface-2/80 p-3 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap gap-x-3 text-xs text-fg-muted">
                      <span>{m.stage}</span>
                      <span className={cn('tabular', !isScheduled(m.time) && 'text-warning')}>{m.time}</span>
                    </p>
                    <p className="mt-1 text-sm font-medium break-words">
                      {m.home.name} <span className="text-fg-muted">vs</span> {m.away.name}
                      {m.score && (
                        <span className="ml-2 font-bold text-gold tabular">
                          {m.score[0]}–{m.score[1]}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<ClipboardPen size={16} aria-hidden />}
                      aria-label={`Nhập tỉ số ${m.stage}: ${m.home.name} gặp ${m.away.name}`}
                      onClick={() => setScoring(m)}
                    >
                      Nhập tỉ số
                    </Button>
                    {d.status !== 'finished' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<CalendarClock size={16} aria-hidden />}
                        aria-label={`Xếp lịch ${m.stage}: ${m.home.name} gặp ${m.away.name}`}
                        onClick={() => setScheduling(m)}
                      >
                        Xếp lịch
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {children}

      <Modal
        open={confirm !== null}
        onClose={closeConfirm}
        title={confirm === 'close' ? 'Đóng đăng ký?' : drawn ? 'Bốc lại nhánh đấu?' : 'Bốc thăm nhánh đấu?'}
      >
        <p className="text-sm text-fg/90">
          {confirm === 'close'
            ? 'Các đội sẽ không thể đăng ký thêm. Thao tác này không hoàn tác được.'
            : drawn
              ? 'Nhánh đấu hiện tại và lịch đã xếp sẽ bị thay bằng kết quả bốc thăm mới.'
              : `Hệ thống xếp ngẫu nhiên ${d.teamList.length} đội đã duyệt vào nhánh loại trực tiếp. Đội thiếu cặp được đi tiếp (BYE). Giải chuyển sang "Đang diễn ra".`}
        </p>
        {confirmError && (
          <p role="alert" className="mt-3 rounded-btn border border-danger/40 bg-danger-bg px-3 py-2 text-sm text-danger">
            {confirmError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" data-autofocus onClick={closeConfirm}>
            Huỷ
          </Button>
          <Button disabled={busy} onClick={runConfirm}>
            {busy ? 'Đang xử lý…' : confirm === 'close' ? 'Đóng đăng ký' : drawn ? 'Bốc lại' : 'Bốc thăm'}
          </Button>
        </div>
      </Modal>

      <ScoreDialog open={scoring !== null} onClose={closeScore} slug={d.slug} match={scoring} series={series} onSaved={refresh} />
      <ScheduleDialog open={scheduling !== null} onClose={closeSchedule} slug={d.slug} match={scheduling} onSaved={refresh} />
    </Card>
  )
}

function ScheduleDialog({
  open,
  onClose,
  slug,
  match,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  slug: string
  match: ScheduledMatch | null
  onSaved: () => Promise<void>
}) {
  const { notify } = useToast()
  const id = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValue('')
    setError('')
    setSaving(false)
  }, [open, match])

  if (!match) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (!value) {
      setError('Chọn ngày giờ thi đấu.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await organizerActions.schedule(slug, match.id, value)
      notify('Đã xếp lịch trận đấu')
      await onSaved()
      onClose()
    } catch (err) {
      setError(organizerErrorMessage(err, 'Không thể xếp lịch. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Xếp lịch trận đấu">
      <form onSubmit={submit} noValidate>
        <p className="text-sm text-fg-muted">
          {match.stage}: {match.home.name} gặp {match.away.name}
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          Hiện tại: <span className="tabular">{match.time}</span>
        </p>
        <label htmlFor={`${id}-at`} className="mt-4 block text-sm font-medium">
          Ngày giờ thi đấu (giờ Việt Nam, GMT+7)
        </label>
        <input
          id={`${id}-at`}
          type="datetime-local"
          data-autofocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className={fieldClass}
        />
        {error && (
          <p id={`${id}-err`} role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu lịch'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
