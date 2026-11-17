import { Fragment, useEffect, useId, useState, type FormEvent } from 'react'
import { CreateRegistrationBodySchema } from '@customaov/contracts'
import { UserPlus } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ApiError, registrationActions, type Registration } from '../../api'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

const MEMBER_COUNT = 5
const SUB_COUNT = 2
const USERNAME_MESSAGE = 'Username dài 3–20 ký tự, chỉ gồm chữ thường, số và dấu gạch dưới (_).'

type FieldKey = 'teamName' | `members.${number}` | `subs.${number}`
type FieldErrors = Partial<Record<FieldKey, string>>

const emptyList = (n: number) => Array.from({ length: n }, () => '')
const normalize = (value: string) => value.trim().toLowerCase()

function formatRegistrationError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return err.message || 'Bạn thao tác quá nhanh, vui lòng thử lại sau.'
    return err.message || 'Có lỗi xảy ra, vui lòng thử lại.'
  }
  return 'Không thể kết nối máy chủ, vui lòng thử lại.'
}

function inputWrapCls(hasError: boolean, readOnly?: boolean): string {
  return cn(
    'flex h-10 items-center rounded-btn border px-3 transition-colors focus-within:border-gold/70',
    readOnly ? 'bg-surface-3/60' : 'bg-black/25',
    hasError ? 'border-danger' : 'border-line-strong',
  )
}

/**
 * Hộp thoại đăng ký đội (chế độ api). Đội trưởng = người đang đăng nhập, luôn là thành viên 1.
 * Validate bằng `CreateRegistrationBodySchema` trước khi gửi; lỗi server hiện trong `role="alert"`.
 * `onClose` phải ổn định (useCallback) — xem ghi chú về Modal trong AGENTS.md.
 */
export function RegisterTeamDialog({
  open,
  onClose,
  slug,
  tournamentName,
  captainUsername,
  onRegistered,
}: {
  open: boolean
  onClose: () => void
  slug: string
  tournamentName: string
  captainUsername: string
  onRegistered: (registration: Registration) => void | Promise<void>
}) {
  const uid = useId()
  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState<string[]>(() => [captainUsername, ...emptyList(MEMBER_COUNT - 1)])
  const [subs, setSubs] = useState<string[]>(() => emptyList(SUB_COUNT))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setTeamName('')
    setMembers([captainUsername, ...emptyList(MEMBER_COUNT - 1)])
    setSubs(emptyList(SUB_COUNT))
    setErrors({})
    setFormError(null)
    setSubmitting(false)
  }, [open, captainUsername])

  const clearError = (key: FieldKey) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
    if (formError) setFormError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setFormError(null)

    const filledSubs = subs.map(normalize).filter(Boolean)
    const parsed = CreateRegistrationBodySchema.safeParse({
      teamName,
      members: members.map(normalize),
      ...(filledSubs.length ? { subs: filledSubs } : {}),
    })
    if (!parsed.success) {
      const next: FieldErrors = {}
      let general: string | null = null
      for (const issue of parsed.error.issues) {
        const [field, index] = issue.path
        if (field === 'teamName') next.teamName ??= 'Nhập tên đội.'
        else if ((field === 'members' || field === 'subs') && typeof index === 'number') {
          // Dự bị đã lọc ô trống nên chỉ số lệch; tìm lại ô theo giá trị.
          const slot = field === 'subs' ? subs.findIndex((s) => normalize(s) === filledSubs[index]) : index
          next[`${field}.${slot}`] ??= USERNAME_MESSAGE
        } else general ??= issue.message
      }
      setErrors(next)
      setFormError(general)
      return
    }

    setErrors({})
    setSubmitting(true)
    try {
      const registration = await registrationActions.create(slug, parsed.data)
      await onRegistered(registration)
    } catch (err: unknown) {
      setFormError(formatRegistrationError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const renderInput = (
    key: FieldKey,
    label: string,
    value: string,
    onChange: (value: string) => void,
    opts: { readOnly?: boolean; placeholder?: string; autoFocus?: boolean; hint?: string } = {},
  ) => {
    const id = `${uid}-${key.replace('.', '-')}`
    const error = errors[key]
    const describedBy = [error && `${id}-err`, opts.hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
    return (
      <div className="min-w-0">
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-fg">
          {label}
        </label>
        <div className={inputWrapCls(Boolean(error), opts.readOnly)}>
          <input
            id={id}
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            data-autofocus={opts.autoFocus ? true : undefined}
            readOnly={opts.readOnly}
            placeholder={opts.placeholder}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              clearError(key)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle read-only:text-fg-muted"
          />
        </div>
        {opts.hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-fg-muted">
            {opts.hint}
          </p>
        )}
        {error && (
          <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Đăng ký đội" className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <p className="text-sm text-fg-muted">
        Đăng ký vào <span className="font-medium text-fg">{tournamentName}</span>. Đơn sẽ chờ ban tổ chức duyệt.
      </p>
      <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4" aria-label="Đăng ký đội">
        {formError && (
          <div role="alert" className="rounded-btn border border-danger/40 bg-danger-bg px-3 py-2 text-sm text-danger">
            {formError}
          </div>
        )}

        {renderInput('teamName', 'Tên đội', teamName, setTeamName, { autoFocus: true, placeholder: 'vd: Rồng Lửa' })}

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold">Thành viên chính (5)</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {members.map((value, i) => (
              <Fragment key={`m${i}`}>
                {renderInput(
                  `members.${i}`,
                  i === 0 ? 'Thành viên 1 (đội trưởng)' : `Thành viên ${i + 1}`,
                  value,
                  (v) => setMembers((prev) => prev.map((m, j) => (j === i ? v : m))),
                  i === 0 ? { readOnly: true, hint: 'Bạn là đội trưởng.' } : { placeholder: 'username' },
                )}
              </Fragment>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold">
            Dự bị <span className="font-normal text-fg-muted">(không bắt buộc, tối đa 2)</span>
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {subs.map((value, i) => (
              <Fragment key={`s${i}`}>
                {renderInput(
                  `subs.${i}`,
                  `Dự bị ${i + 1}`,
                  value,
                  (v) => setSubs((prev) => prev.map((s, j) => (j === i ? v : s))),
                  { placeholder: 'username' },
                )}
              </Fragment>
            ))}
          </div>
        </fieldset>

        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Huỷ
          </Button>
          <Button type="submit" disabled={submitting} leftIcon={<UserPlus size={16} aria-hidden />}>
            {submitting ? 'Đang gửi…' : 'Gửi đăng ký'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
