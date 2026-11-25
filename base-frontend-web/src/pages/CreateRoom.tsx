import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BarChart3, Scale, Shuffle, Smile, Swords } from 'lucide-react'
import { cn } from '../lib/cn'
import { useAuth, useToast } from '../context/AppContext'
import {
  ACCESS_LABEL,
  ApiError,
  DEFAULT_ROOM_CONFIG,
  PLAY_STYLE_DESCRIPTION,
  PLAY_STYLE_LABEL,
  RoomConfigValidationError,
  SERIES_LABEL,
  SPLIT_TOOL_DESCRIPTION,
  SPLIT_TOOL_LABEL,
  createRoomWithConfig,
  validateRoomConfig,
  type RoomAccess,
  type RoomConfig,
  type RoomConfigErrors,
  type RoomConfigField,
  type RoomPlayStyle,
  type RoomSeries,
  type RoomSplitTool,
} from '../api'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/primitives'
import { RadioGroup, type RadioOption } from '../components/ui/RadioGroup'
import { PageHeader } from '../components/layout/PageHeader'

type Step = 1 | 2 | 3 | 4

const STEPS: ReadonlyArray<{ n: Step; label: string }> = [
  { n: 1, label: '1. Phòng' },
  { n: 2, label: '2. Chế độ' },
  { n: 3, label: '3. Công cụ' },
  { n: 4, label: '4. Xem lại' },
]

const STEP_TITLE: Record<Step, string> = {
  1: 'Bước 1 — Thông tin phòng',
  2: 'Bước 2 — Phong cách thi đấu',
  3: 'Bước 3 — Công cụ chia đội',
  4: 'Bước 4 — Xem lại',
}

const STEP_BY_FIELD: Record<RoomConfigField, Step> = {
  name: 1,
  series: 1,
  access: 1,
  playStyle: 2,
  splitTool: 3,
}

const API_FIELD_MAP: Record<string, RoomConfigField> = {
  title: 'name',
  'config.series': 'series',
  visibility: 'access',
  mode: 'playStyle',
  'config.pickMode': 'splitTool',
}

const SERIES_OPTIONS: ReadonlyArray<RadioOption<RoomSeries>> = [
  { value: 'BO3', label: SERIES_LABEL.BO3 },
  { value: 'BO5', label: SERIES_LABEL.BO5 },
  { value: 'BO7', label: SERIES_LABEL.BO7 },
]

const ACCESS_OPTIONS: ReadonlyArray<RadioOption<RoomAccess>> = [
  { value: 'public', label: ACCESS_LABEL.public },
  { value: 'private', label: ACCESS_LABEL.private },
]

const PLAY_STYLE_OPTIONS: ReadonlyArray<RadioOption<RoomPlayStyle>> = [
  {
    value: 'fun',
    label: PLAY_STYLE_LABEL.fun,
    description: PLAY_STYLE_DESCRIPTION.fun,
    icon: <Smile size={18} strokeWidth={1.8} />,
  },
  {
    value: 'tryhard',
    label: PLAY_STYLE_LABEL.tryhard,
    description: PLAY_STYLE_DESCRIPTION.tryhard,
    icon: <Swords size={18} strokeWidth={1.8} />,
  },
]

const SPLIT_TOOL_OPTIONS: ReadonlyArray<RadioOption<RoomSplitTool>> = [
  {
    value: 'random',
    label: SPLIT_TOOL_LABEL.random,
    description: SPLIT_TOOL_DESCRIPTION.random,
    icon: <Shuffle size={18} strokeWidth={1.8} />,
  },
  {
    value: 'tier',
    label: SPLIT_TOOL_LABEL.tier,
    description: SPLIT_TOOL_DESCRIPTION.tier,
    icon: <Scale size={18} strokeWidth={1.8} />,
  },
  {
    value: 'rank',
    label: SPLIT_TOOL_LABEL.rank,
    description: SPLIT_TOOL_DESCRIPTION.rank,
    icon: <BarChart3 size={18} strokeWidth={1.8} />,
  },
]

function mapApiErrors(err: unknown): RoomConfigErrors | null {
  if (err instanceof RoomConfigValidationError) return err.errors
  if (err instanceof ApiError && err.status === 400) {
    const mapped: RoomConfigErrors = {}
    for (const [path, message] of Object.entries(err.fieldErrors())) {
      const field = API_FIELD_MAP[path]
      if (field) mapped[field] = message
    }
    return Object.keys(mapped).length ? mapped : null
  }
  return null
}

export default function CreateRoom() {
  const { canOrganize } = useAuth()
  const navigate = useNavigate()
  const { notify } = useToast()
  const uid = useId()

  const [step, setStep] = useState<Step>(1)
  const [reached, setReached] = useState<Step>(1)
  const [config, setConfig] = useState<RoomConfig>(DEFAULT_ROOM_CONFIG)
  const [fieldErrors, setFieldErrors] = useState<RoomConfigErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const updateField = <K extends RoomConfigField>(field: K, value: RoomConfig[K]) => {
    setConfig((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validateStep1 = (): boolean => {
    const all = validateRoomConfig(config)
    const step1Errors: RoomConfigErrors = {}
    if (all.name) step1Errors.name = all.name
    if (all.series) step1Errors.series = all.series
    if (all.access) step1Errors.access = all.access
    if (Object.keys(step1Errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...step1Errors }))
      if (step1Errors.name) document.getElementById(`${uid}-name`)?.focus()
      return false
    }
    return true
  }

  const goTo = (target: Step) => {
    if (target > step && step === 1 && !validateStep1()) return
    setFormError(null)
    setStep(target)
    setReached((prev) => (target > prev ? target : prev))
    document.getElementById(`${uid}-step-title`)?.scrollIntoView?.({ block: 'nearest' })
  }

  const jumpToErrors = (errors: RoomConfigErrors) => {
    setFieldErrors(errors)
    const fields = Object.keys(errors) as RoomConfigField[]
    if (!fields.length) return
    const earliest = Math.min(...fields.map((field) => STEP_BY_FIELD[field])) as Step
    setStep(earliest)
    if (errors.name) {
      window.requestAnimationFrame(() => document.getElementById(`${uid}-name`)?.focus())
    }
  }

  const handleCreate = async () => {
    if (!canOrganize) { setFormError('Bạn cần quyền quản trị viên để tạo phòng.'); return }
    const errors = validateRoomConfig(config)
    if (Object.keys(errors).length > 0) {
      jumpToErrors(errors)
      return
    }
    if (submitting) return
    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})
    try {
      const result = await createRoomWithConfig({ ...config, name: config.name.trim() })
      notify('Đã tạo phòng', `${result.config.name} đã sẵn sàng ở trạng thái OPEN.`)
      navigate(`/rooms/${result.roomId}`, {
        state: { roomConfig: result.config, configPersisted: result.configPersisted },
      })
    } catch (err) {
      const mapped = mapApiErrors(err)
      if (mapped) {
        jumpToErrors(mapped)
      } else {
        setFormError(err instanceof Error ? err.message : 'Không thể tạo phòng. Vui lòng thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title="Tạo phòng Custom"
        actions={<Badge tone="neutral">Đề xuất</Badge>}
      />

      {/* Không dùng overflow-hidden ở khung ngoài để thanh hành động sticky trên mobile hoạt động */}
      <div className="mt-6 rounded-card border border-line-strong/70 bg-surface/90 p-4 md:p-6">
        <nav aria-label="Các bước tạo phòng">
          <ol className="grid grid-cols-2 gap-1 rounded-card border border-line bg-surface-2 p-1 sm:grid-cols-4 sm:rounded-full">
            {STEPS.map((item) => {
              const active = item.n === step
              const locked = item.n > reached
              return (
                <li key={item.n} className="min-w-0">
                  <button
                    type="button"
                    disabled={locked}
                    aria-current={active ? 'step' : undefined}
                    onClick={() => goTo(item.n)}
                    className={cn(
                      'w-full rounded-btn px-3 py-2 text-center text-sm whitespace-nowrap transition-colors sm:rounded-full',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                      active
                        ? 'bg-surface-4 font-semibold text-fg'
                        : 'text-fg-muted enabled:hover:text-fg',
                      locked && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <form
          noValidate
          aria-labelledby={`${uid}-step-title`}
          className="mt-6 flex min-w-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            if (step < 4) goTo((step + 1) as Step)
            else void handleCreate()
          }}
        >
          <h2 id={`${uid}-step-title`} className="text-lg font-semibold">
            {STEP_TITLE[step]}
          </h2>

          {step === 1 && (
            <div className="mt-4 flex flex-col gap-6">
              <div>
                <label htmlFor={`${uid}-name`} className="block text-sm font-medium text-fg">
                  Tên phòng
                </label>
                <input
                  id={`${uid}-name`}
                  type="text"
                  maxLength={60}
                  placeholder="Custom 5v5 cùng anh em"
                  value={config.name}
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? `${uid}-name-err` : undefined}
                  onChange={(event) => updateField('name', event.target.value)}
                  className={cn(
                    'mt-2 h-11 w-full rounded-full border bg-surface-2 px-4 text-sm text-fg placeholder:text-fg-subtle',
                    'focus:outline-2 focus:outline-offset-2 focus:outline-gold',
                    fieldErrors.name ? 'border-danger' : 'border-line-strong',
                  )}
                />
                {fieldErrors.name && (
                  <p id={`${uid}-name-err`} role="alert" className="mt-2 text-sm text-danger">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div>
                <span id={`${uid}-series-label`} className="block text-sm font-medium text-fg">
                  Thể thức
                </span>
                <RadioGroup
                  variant="inline"
                  ariaLabelledBy={`${uid}-series-label`}
                  value={config.series}
                  onChange={(value) => updateField('series', value)}
                  options={SERIES_OPTIONS}
                  className="mt-2"
                />
                {fieldErrors.series && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    {fieldErrors.series}
                  </p>
                )}
              </div>

              <div>
                <span id={`${uid}-access-label`} className="block text-sm font-medium text-fg">
                  Quyền truy cập
                </span>
                <RadioGroup
                  variant="inline"
                  ariaLabelledBy={`${uid}-access-label`}
                  value={config.access}
                  onChange={(value) => updateField('access', value)}
                  options={ACCESS_OPTIONS}
                  className="mt-2"
                />
                {fieldErrors.access && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    {fieldErrors.access}
                  </p>
                )}
                <p className="mt-3 text-xs text-fg-muted">
                  Invite link sẽ được tạo tự động sau khi tạo phòng thành công, không cần nhập thủ công.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-4 flex flex-col gap-4">
              <RadioGroup
                variant="card"
                ariaLabel="Phong cách thi đấu"
                value={config.playStyle}
                onChange={(value) => updateField('playStyle', value)}
                options={PLAY_STYLE_OPTIONS}
              />
              {fieldErrors.playStyle && (
                <p role="alert" className="text-sm text-danger">
                  {fieldErrors.playStyle}
                </p>
              )}
              <p className="text-xs text-fg-muted">
                Phong cách thi đấu không ép buộc thuật toán chia đội. Host có thể chọn Random, Tier hoặc Rank ở bước tiếp theo.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="mt-4 flex flex-col gap-4">
              <RadioGroup
                variant="card"
                ariaLabel="Công cụ chia đội"
                value={config.splitTool}
                onChange={(value) => updateField('splitTool', value)}
                options={SPLIT_TOOL_OPTIONS}
              />
              {fieldErrors.splitTool && (
                <p role="alert" className="text-sm text-danger">
                  {fieldErrors.splitTool}
                </p>
              )}
              <p className="text-xs text-fg-muted">
                Đây là công cụ mặc định của Host khi Prepare; có thể cho phép thay đổi trước khi khóa đội hình.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="mt-4 flex flex-col gap-4">
              <p className="text-sm text-fg-muted">
                Xác nhận cấu hình phòng, sau đó tạo Room ở trạng thái OPEN.
              </p>
              <dl className="grid grid-cols-[minmax(130px,auto)_1fr] gap-x-6 gap-y-3 rounded-card border border-line bg-surface-2/60 p-4 text-sm">
                <dt className="text-fg-muted">Tên phòng</dt>
                <dd className="min-w-0 font-semibold break-words text-fg">{config.name.trim()}</dd>

                <dt className="text-fg-muted">Thể thức</dt>
                <dd className="font-semibold text-fg">{SERIES_LABEL[config.series]}</dd>

                <dt className="text-fg-muted">Quyền truy cập</dt>
                <dd className="font-semibold text-fg">{ACCESS_LABEL[config.access]}</dd>

                <dt className="text-fg-muted">Phong cách</dt>
                <dd className="font-semibold text-fg">{PLAY_STYLE_LABEL[config.playStyle]}</dd>

                <dt className="text-fg-muted">Chia đội</dt>
                <dd className="font-semibold text-fg">{SPLIT_TOOL_LABEL[config.splitTool]}</dd>

                <dt className="text-fg-muted">Trạng thái ban đầu</dt>
                <dd className="font-semibold text-fg">
                  <Badge tone="success">OPEN</Badge>
                </dd>
              </dl>
            </div>
          )}

          {formError && (
            <p
              role="alert"
              className="mt-4 rounded-btn border border-danger/40 bg-danger-bg px-3 py-2 text-sm text-danger"
            >
              {formError}
            </p>
          )}

          <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-between gap-3 border-t border-line bg-surface/95 pt-4 backdrop-blur-sm">
            <Button
              type="button"
              variant="ghost"
              leftIcon={<ArrowLeft size={16} aria-hidden />}
              disabled={step === 1 || submitting}
              onClick={() => goTo((step - 1) as Step)}
            >
              Quay lại
            </Button>

            {step < 4 ? (
              <Button type="submit" variant="primary" rightIcon={<ArrowRight size={16} aria-hidden />}>
                Tiếp tục
              </Button>
            ) : (
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Đang tạo phòng…' : 'Tạo phòng'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
