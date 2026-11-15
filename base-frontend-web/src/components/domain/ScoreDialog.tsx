import { useEffect, useId, useState, type FormEvent } from 'react'
import { isValidSeriesScore, type Series } from '@customaov/contracts'
import { WINS_NEEDED, organizerActions, organizerErrorMessage, type ScheduledMatch } from '../../api'
import { useToast } from '../../context/AppContext'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

const selectClass =
  'mt-2 w-full rounded-btn border border-line-strong bg-surface-2 px-3 py-2 text-base text-fg tabular outline-none transition-colors focus:border-gold/70 focus:ring-2 focus:ring-gold/15 aria-invalid:border-danger aria-invalid:ring-danger/15'

/**
 * Hộp nhập tỉ số một trận (BTC). Chỉ cho gửi tỉ số hợp lệ theo BO (`isValidSeriesScore`):
 * vd. BO3 = 2–0 hoặc 2–1. Lỗi 409 từ server (trận vòng sau đã có tỉ số, trận chưa đủ đội) hiện ngay trong hộp.
 */
export function ScoreDialog({
  open,
  onClose,
  slug,
  match,
  series,
  onSaved,
}: {
  open: boolean
  /** Phải ổn định (useCallback): Modal quản lý focus theo prop này */
  onClose: () => void
  slug: string
  match: ScheduledMatch | null
  series: Series
  /** Tải lại chi tiết giải; tự xử lý lỗi của nó (không ném) */
  onSaved: () => Promise<void>
}) {
  const { notify } = useToast()
  const id = useId()
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setScoreA(match?.score ? String(match.score[0]) : '')
    setScoreB(match?.score ? String(match.score[1]) : '')
    setServerError('')
    setSaving(false)
  }, [open, match])

  if (!match) return null

  const target = WINS_NEEDED[series]
  const options = Array.from({ length: target + 1 }, (_, i) => i)
  const filled = scoreA !== '' && scoreB !== ''
  const valid = filled && isValidSeriesScore(series, Number(scoreA), Number(scoreB))
  const invalidMessage =
    filled && !valid ? `Tỉ số ${scoreA}–${scoreB} không hợp lệ với thể thức ${series}: một đội phải thắng đúng ${target} ván, đội còn lại ít hơn.` : ''

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || saving) return
    setServerError('')
    setSaving(true)
    try {
      await organizerActions.score(slug, match.id, Number(scoreA), Number(scoreB))
      notify('Đã lưu tỉ số', `${match.home.name} ${scoreA}–${scoreB} ${match.away.name}`)
      await onSaved()
      onClose()
    } catch (error) {
      setServerError(organizerErrorMessage(error, 'Không thể lưu tỉ số. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nhập tỉ số">
      <form onSubmit={submit} noValidate>
        <p className="text-sm text-fg-muted">
          {match.stage} · Thể thức {series} (thắng {target} ván)
        </p>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
          <label className="min-w-0 text-sm font-medium break-words" htmlFor={`${id}-a`}>
            {match.home.name}
            <select
              id={`${id}-a`}
              data-autofocus
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              aria-invalid={Boolean(invalidMessage) || undefined}
              aria-describedby={invalidMessage ? `${id}-err` : undefined}
              className={selectClass}
            >
              <option value="">–</option>
              {options.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span aria-hidden className="pb-2 text-lg font-bold text-fg-muted">
            –
          </span>
          <label className="min-w-0 text-sm font-medium break-words" htmlFor={`${id}-b`}>
            {match.away.name}
            <select
              id={`${id}-b`}
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              aria-invalid={Boolean(invalidMessage) || undefined}
              aria-describedby={invalidMessage ? `${id}-err` : undefined}
              className={selectClass}
            >
              <option value="">–</option>
              {options.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {invalidMessage && (
          <p id={`${id}-err`} role="alert" className="mt-3 text-sm text-danger">
            {invalidMessage}
          </p>
        )}
        {serverError && (
          <p role="alert" className="mt-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            {saving ? 'Đang lưu…' : 'Lưu tỉ số'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
