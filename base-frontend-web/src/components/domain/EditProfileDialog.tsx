import { useEffect, useState, type FormEvent } from 'react'
import { UpdateMeBodySchema, type UpdateMeBody } from '@customaov/contracts'
import { profileAdapter, updateProfile, type UserProfile } from '../../api'
import { useToast } from '../../context/AppContext'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

type FieldName = 'displayName' | 'bio' | 'bioExtra' | 'avatarUrl'
type FieldErrors = Partial<Record<FieldName, string>>

const fieldClass =
  'mt-2 w-full rounded-btn border border-line-strong bg-surface-2 px-3 py-2 text-base text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-gold/70 focus:ring-2 focus:ring-gold/15 aria-invalid:border-danger aria-invalid:ring-danger/15'

const editableAvatarUrl = (value: string | undefined): string => value?.startsWith('https://') ? value : ''

export function EditProfileDialog({
  open,
  onClose,
  profile,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  profile: UserProfile
  onSaved: () => void
}) {
  const { notify } = useToast()
  const [displayName, setDisplayName] = useState(profile.player.name)
  const [bio, setBio] = useState(profile.bio)
  const [bioExtra, setBioExtra] = useState(profile.bioExtra)
  const [avatarUrl, setAvatarUrl] = useState(editableAvatarUrl(profile.player.avatar))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDisplayName(profile.player.name)
    setBio(profile.bio)
    setBioExtra(profile.bioExtra)
    setAvatarUrl(editableAvatarUrl(profile.player.avatar))
    setErrors({})
    setServerError('')
    setSaving(false)
  }, [open, profile])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setServerError('')
    const candidate: UpdateMeBody = {
      displayName,
      bio,
      bioExtra,
      avatarUrl: avatarUrl.trim() || null,
    }
    const parsed = UpdateMeBodySchema.safeParse(candidate)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && field in candidate && !next[field as FieldName]) {
          next[field as FieldName] = issue.message
        }
      }
      setErrors(next)
      return
    }

    setErrors({})
    setSaving(true)
    try {
      await updateProfile(parsed.data)
      notify(profileAdapter.persistsWrites ? 'Đã cập nhật hồ sơ' : 'Đã lưu (giả lập)')
      if (profileAdapter.persistsWrites) onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Không thể lưu hồ sơ. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const errorProps = (field: FieldName) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `edit-profile-${field}-error` : undefined,
  })

  return (
    <Modal open={open} onClose={onClose} title="Chỉnh sửa hồ sơ" className="max-w-[560px]">
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <label className="text-sm font-medium">
          Tên hiển thị
          <input
            data-autofocus
            aria-label="Tên hiển thị"
            className={fieldClass}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            {...errorProps('displayName')}
          />
          {errors.displayName && <span id="edit-profile-displayName-error" className="mt-1 block text-sm text-danger">{errors.displayName}</span>}
        </label>

        <label className="text-sm font-medium">
          Giới thiệu
          <textarea
            aria-label="Giới thiệu"
            className={`${fieldClass} min-h-24 resize-y`}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            {...errorProps('bio')}
          />
          <span className="mt-1 flex justify-between gap-3 text-xs text-fg-muted">
            {errors.bio ? <span id="edit-profile-bio-error" className="text-danger">{errors.bio}</span> : <span />}
            <span className="tabular">{bio.length}/280</span>
          </span>
        </label>

        <label className="text-sm font-medium">
          Giới thiệu thêm
          <textarea
            aria-label="Giới thiệu thêm"
            className={`${fieldClass} min-h-24 resize-y`}
            value={bioExtra}
            onChange={(event) => setBioExtra(event.target.value)}
            {...errorProps('bioExtra')}
          />
          <span className="mt-1 flex justify-between gap-3 text-xs text-fg-muted">
            {errors.bioExtra ? <span id="edit-profile-bioExtra-error" className="text-danger">{errors.bioExtra}</span> : <span />}
            <span className="tabular">{bioExtra.length}/280</span>
          </span>
        </label>

        <label className="text-sm font-medium">
          URL ảnh đại diện
          <input
            aria-label="URL ảnh đại diện"
            className={fieldClass}
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            type="url"
            inputMode="url"
            placeholder="https://example.com/avatar.jpg"
            {...errorProps('avatarUrl')}
          />
          {errors.avatarUrl && <span id="edit-profile-avatarUrl-error" className="mt-1 block text-sm text-danger">{errors.avatarUrl}</span>}
        </label>

        {serverError && <p role="alert" className="rounded-btn border border-danger/30 bg-danger-bg/30 px-3 py-2 text-sm text-danger">{serverError}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</Button>
        </div>
      </form>
    </Modal>
  )
}
