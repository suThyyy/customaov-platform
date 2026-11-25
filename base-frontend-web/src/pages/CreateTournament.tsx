import { useId, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CalendarDays,
  Check,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  Repeat,
  ScrollText,
  Sparkles,
  SquarePen,
  Trash2,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { CreateTournamentBodySchema, type CreateTournamentBody, type Series, type TeamCount } from '@customaov/contracts'
import { ApiError, createTournament, tournamentsAdapter } from '../api'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, IconButton } from '../components/ui/Button'
import { useAuth, useToast } from '../context/AppContext'
import { asset } from '../lib/asset'
import { cn } from '../lib/cn'

type Step = 1 | 2 | 3 | 4
type CoverId = CreateTournamentBody['cover']
type PrizeDraft = { place: string; reward: string }

const STEPS: Array<{ n: Step; label: string; icon: LucideIcon }> = [
  { n: 1, label: 'Thông tin', icon: SquarePen },
  { n: 2, label: 'Thể thức', icon: Trophy },
  { n: 3, label: 'Lịch thi đấu', icon: CalendarDays },
  { n: 4, label: 'Luật & giải thưởng', icon: ClipboardCheck },
]

const COVERS: Array<{ id: CoverId; label: string; src: string }> = [
  { id: 'tour-1', label: 'Ảnh bìa 1', src: asset('tour-1.jpg') },
  { id: 'tour-2', label: 'Ảnh bìa 2', src: asset('tour-2.jpg') },
  { id: 'tour-3', label: 'Ảnh bìa 3', src: asset('tour-3.jpg') },
]

const TEAM_COUNTS: Array<{ id: `${TeamCount}`; value: TeamCount; title: string; sub: string }> = [
  { id: '4', value: 4, title: '4 đội', sub: 'Bán kết → Chung kết' },
  { id: '8', value: 8, title: '8 đội', sub: 'Tứ kết → Chung kết' },
  { id: '16', value: 16, title: '16 đội', sub: 'Vòng 1/8 → Chung kết' },
]

const SERIES_OPTIONS: Array<{ id: Series; title: string; sub: string }> = [
  { id: 'BO1', title: 'BO1', sub: '1 ván' },
  { id: 'BO3', title: 'BO3', sub: 'Thắng 2 ván' },
  { id: 'BO5', title: 'BO5', sub: 'Thắng 3 ván' },
]

const NAME_MAX = 60
const DESC_MAX = 200

const STEP_FIELDS: Record<Step, string[]> = {
  1: ['name', 'titleAccent', 'description', 'intro', 'cover'],
  2: ['teamCount', 'series'],
  3: ['registrationDeadline', 'drawDate', 'dateStart', 'dateEnd'],
  4: ['rules', 'prizes'],
}

function toIsoOrEmpty(localValue: string): string {
  if (!localValue.trim()) return ''
  const date = new Date(localValue)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function formatDateTimeDisplay(localValue: string): string {
  if (!localValue.trim()) return '—'
  const date = new Date(localValue)
  if (Number.isNaN(date.getTime())) return localValue
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapIssueMessage(pathKey: string, defaultMessage: string, isCustom: boolean): string {
  if (isCustom) return defaultMessage
  if (pathKey === 'name') return 'Vui lòng nhập tên giải đấu (tối đa 60 ký tự).'
  if (pathKey === 'registrationDeadline' || pathKey === 'drawDate' || pathKey === 'dateStart' || pathKey === 'dateEnd') {
    return 'Vui lòng chọn ngày giờ hợp lệ.'
  }
  if (pathKey.endsWith('.place')) return 'Vui lòng nhập thứ hạng.'
  if (pathKey.endsWith('.reward')) return 'Vui lòng nhập phần thưởng.'
  return defaultMessage
}

function apiFieldErrors(details: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!Array.isArray(details)) return result
  for (const item of details) {
    if (typeof item !== 'object' || item === null) continue
    const { path, message } = item as { path?: unknown; message?: unknown }
    if (typeof path === 'string' && path && typeof message === 'string' && !result[path]) result[path] = message
  }
  return result
}

export default function CreateTournament() {
  const { canOrganize } = useAuth()
  const navigate = useNavigate()
  const { notify } = useToast()
  const uid = useId()

  const [step, setStep] = useState<Step>(1)
  const [reached, setReached] = useState<Step>(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Bước 1: Thông tin
  const [name, setName] = useState('Cúp Cộng Đồng Liên Quân')
  const [titleAccent, setTitleAccent] = useState('Mùa 1')
  const [description, setDescription] = useState('Giải đấu 5v5 cộng đồng dành cho các đội tuyển bán chuyên và phong trào.')
  const [introText, setIntroText] = useState(
    'Giải đấu diễn ra theo thể thức loại trực tiếp.\nCác đội cần check-in trước giờ thi đấu 15 phút.',
  )
  const [cover, setCover] = useState<CoverId>('tour-1')

  // Bước 2: Thể thức
  const [teamCount, setTeamCount] = useState<TeamCount>(8)
  const [series, setSeries] = useState<Series>('BO3')

  // Bước 3: Lịch thi đấu
  const [registrationDeadline, setRegistrationDeadline] = useState('2026-11-20T23:59')
  const [drawDate, setDrawDate] = useState('2026-11-21T19:00')
  const [dateStart, setDateStart] = useState('2026-11-22T18:00')
  const [dateEnd, setDateEnd] = useState('2026-11-27T22:00')

  // Bước 4: Luật và giải thưởng
  const [rules, setRules] = useState<string[]>([
    'Đội hình gồm 5 thành viên chính thức và tối đa 2 dự bị.',
    'Có mặt tại phòng đấu trước giờ thi đấu 15 phút.',
  ])
  const [prizes, setPrizes] = useState<PrizeDraft[]>([
    { place: 'Hạng 1', reward: '1.000.000đ + Cúp vô địch' },
    { place: 'Hạng 2', reward: '500.000đ' },
  ])

  const buildPayload = (): CreateTournamentBody => ({
    name,
    ...(titleAccent.trim() ? { titleAccent: titleAccent.trim() } : {}),
    description: description.trim(),
    intro: introText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    teamCount,
    series,
    registrationDeadline: toIsoOrEmpty(registrationDeadline),
    drawDate: toIsoOrEmpty(drawDate),
    dateStart: toIsoOrEmpty(dateStart),
    dateEnd: toIsoOrEmpty(dateEnd),
    rules: rules.map((r) => r.trim()).filter(Boolean),
    prizes: prizes.map((p) => ({ place: p.place.trim(), reward: p.reward.trim() })),
    cover,
  })

  const collectErrors = (): Record<string, string> => {
    const payload = buildPayload()
    const parsed = CreateTournamentBodySchema.safeParse(payload)
    const nextErrors: Record<string, string> = {}

    if (name.trim().length > NAME_MAX) {
      nextErrors.name = `Tên giải đấu tối đa ${NAME_MAX} ký tự.`
    }

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.')
        if (key && !nextErrors[key]) {
          nextErrors[key] = mapIssueMessage(key, issue.message, issue.code === 'custom')
        }
      }
    }
    return nextErrors
  }

  const fieldDomId = (key: string): string => {
    if (key.startsWith('prizes.')) {
      const [, idx, prop] = key.split('.')
      return `${uid}-prize-${prop}-${idx}`
    }
    return `${uid}-${key}`
  }

  const keysForStep = (targetStep: Step, allErrors: Record<string, string>): string[] => {
    const prefixes = STEP_FIELDS[targetStep]
    return Object.keys(allErrors).filter((key) => prefixes.some((p) => key === p || key.startsWith(`${p}.`)))
  }

  const validateStep = (targetStep: Step): boolean => {
    const allErrors = collectErrors()
    const stepKeys = keysForStep(targetStep, allErrors)
    if (stepKeys.length === 0) {
      setErrors((prev) => {
        const next = { ...prev }
        for (const k of Object.keys(next)) {
          if (STEP_FIELDS[targetStep].some((p) => k === p || k.startsWith(`${p}.`))) delete next[k]
        }
        return next
      })
      return true
    }

    const stepErrorMap: Record<string, string> = {}
    for (const k of stepKeys) stepErrorMap[k] = allErrors[k]
    setErrors((prev) => ({ ...prev, ...stepErrorMap }))

    // Focus ô lỗi đầu tiên theo thứ tự trường của bước
    const orderedKeys =
      targetStep === 4
        ? prizes.flatMap((_, i) => [`prizes.${i}.place`, `prizes.${i}.reward`]).filter((k) => k in stepErrorMap)
        : STEP_FIELDS[targetStep].filter((k) => k in stepErrorMap)
    const firstKey = orderedKeys[0] ?? stepKeys[0]
    if (firstKey) {
      document.getElementById(fieldDomId(firstKey))?.focus()
    }
    return false
  }

  const clearError = (key: string) => {
    if (!errors[key]) return
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const clearScheduleErrors = () => {
    setErrors((prev) => {
      const next = { ...prev }
      for (const k of STEP_FIELDS[3]) delete next[k]
      return next
    })
  }

  const goTo = (target: Step) => {
    if (target > step) {
      for (let s = step; s < target; s += 1) {
        if (!validateStep(s as Step)) {
          if (s !== step) setStep(s as Step)
          return
        }
      }
    }
    setStep(target)
    setReached((r) => (target > r ? target : r))
    document.getElementById(`${uid}-step-title`)?.scrollIntoView?.({ block: 'nearest' })
  }

  const handleSubmit = async () => {
    if (!canOrganize) { setSubmitError('Bạn cần quyền quản trị viên để tạo giải đấu.'); return }
    const allErrors = collectErrors()
    const firstInvalidStep = ([1, 2, 3, 4] as Step[]).find((s) => keysForStep(s, allErrors).length > 0)
    if (firstInvalidStep) {
      setErrors(allErrors)
      if (firstInvalidStep !== step) {
        setStep(firstInvalidStep)
        // Chờ DOM render bước lỗi trước khi focus
        requestAnimationFrame(() => validateStep(firstInvalidStep))
      } else {
        validateStep(firstInvalidStep)
      }
      return
    }

    const payload = buildPayload()
    setSubmitting(true)
    setSubmitError('')
    try {
      const created = await createTournament(payload)
      if (tournamentsAdapter.persistsWrites) {
        navigate(`/tournaments/${created.slug}`)
      } else {
        notify('Đã tạo giải (giả lập)', `${payload.name} · ${payload.teamCount} đội · ${payload.series}.`)
        navigate('/tournaments')
      }
    } catch (error) {
      const fieldErrors = error instanceof ApiError && error.status === 400 ? apiFieldErrors(error.details) : {}
      const keys = Object.keys(fieldErrors)
      const badStep = ([1, 2, 3, 4] as Step[]).find((s) => keysForStep(s, fieldErrors).length > 0)
      if (badStep) {
        setErrors(fieldErrors)
        setStep(badStep)
        requestAnimationFrame(() => {
          const first = STEP_FIELDS[badStep].find((k) => k in fieldErrors) ?? keys[0]
          document.getElementById(fieldDomId(first))?.focus()
        })
      } else {
        setSubmitError(error instanceof ApiError ? error.message : 'Không thể tạo giải đấu. Vui lòng thử lại.')
        if (!tournamentsAdapter.persistsWrites) notify('Không thể tạo giải đấu', 'Vui lòng kiểm tra lại thông tin và thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const activeRules = rules.map((r) => r.trim()).filter(Boolean)
  const activeCover = COVERS.find((c) => c.id === cover)!

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Tạo giải đấu"
        description="Thiết lập thông tin, thể thức, lịch thi đấu, luật lệ và giải thưởng cho giải đấu cộng đồng mới."
      />

      {/* Không dùng overflow-hidden ở khung này: sẽ làm hỏng thanh hành động sticky trên mobile */}
      <div className="mt-6 grid grid-cols-1 rounded-card border border-line-strong/70 bg-surface/90 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Các bước tạo giải"
          className="relative overflow-x-auto border-b border-line-strong/70 p-3 lg:border-r lg:border-b-0 lg:p-4"
        >
          <ol className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-0">
            {STEPS.map((s, i) => {
              const active = s.n === step
              const done = !active && s.n < Math.max(step, reached)
              const locked = s.n > reached
              return (
                <li
                  key={s.n}
                  className={cn(
                    'flex min-w-0 items-center gap-2 lg:flex-none lg:flex-col lg:items-stretch lg:gap-0',
                    i < STEPS.length - 1 ? 'flex-1' : 'flex-none',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => goTo(s.n)}
                    disabled={locked}
                    aria-current={active ? 'step' : undefined}
                    aria-label={`Bước ${s.n}: ${s.label}${done ? ' (đã xong)' : ''}`}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-btn border px-2 text-left text-base whitespace-nowrap transition-colors lg:w-full',
                      active
                        ? 'border-gold/70 bg-[linear-gradient(90deg,rgb(242_180_99/0.28),rgb(242_180_99/0.08))] font-semibold'
                        : 'border-transparent enabled:hover:bg-white/[0.04]',
                      locked && 'cursor-not-allowed text-fg-muted',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                        active ? 'bg-gold-gradient text-gold-ink' : done ? 'bg-gold/20 text-gold' : 'bg-surface-3 text-fg',
                      )}
                    >
                      {done ? <Check size={16} strokeWidth={3} /> : s.n}
                    </span>
                    <span aria-hidden className={cn('hidden', active ? 'sm:inline' : 'lg:inline')}>
                      {s.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        'h-px min-w-2 flex-1 lg:my-1 lg:ml-6 lg:h-4 lg:w-px lg:flex-none',
                        s.n < step ? 'bg-gold/80' : 'bg-line-strong',
                      )}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        <form
          noValidate
          aria-labelledby={`${uid}-step-title`}
          className="flex min-w-0 flex-col px-4 pt-4 md:px-6 lg:pt-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (step < 4) goTo((step + 1) as Step)
            else void handleSubmit()
          }}
        >
          <p className="text-xs font-semibold tracking-[0.06em] text-gold uppercase">
            Bước {step}/{STEPS.length}
          </p>
          <h2 id={`${uid}-step-title`} className="mt-1 text-2xl font-semibold">
            {STEPS[step - 1].label}
          </h2>

          {step === 1 && (
            <>
              <p className="mt-1 text-base text-fg/85">Nhập tên giải đấu, phần giới thiệu và chọn ảnh bìa hiển thị.</p>

              <div className="mt-6 flex flex-col gap-6">
                <FieldRow icon={SquarePen} label="Tên giải đấu" required htmlFor={`${uid}-name`}>
                  <div
                    className={cn(
                      'flex h-10 items-center gap-3 rounded-btn border bg-black/25 px-4 transition-colors focus-within:border-gold/70',
                      errors.name ? 'border-danger' : 'border-line-strong',
                    )}
                  >
                    <input
                      id={`${uid}-name`}
                      value={name}
                      maxLength={NAME_MAX}
                      required
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? `${uid}-name-err` : undefined}
                      onChange={(e) => {
                        setName(e.target.value)
                        if (e.target.value.trim() && e.target.value.trim().length <= NAME_MAX) clearError('name')
                      }}
                      placeholder="Ví dụ: Ngũ Kiệt Cup – Mùa 1"
                      className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
                    />
                    <span className="shrink-0 text-sm text-fg-muted tabular" aria-live="polite">
                      {name.length}/{NAME_MAX}
                    </span>
                  </div>
                  {errors.name && (
                    <p id={`${uid}-name-err`} role="alert" className="mt-2 text-sm text-danger">
                      {errors.name}
                    </p>
                  )}
                </FieldRow>

                <FieldRow icon={Sparkles} label="Tiêu đề nhấn" htmlFor={`${uid}-titleAccent`}>
                  <input
                    id={`${uid}-titleAccent`}
                    value={titleAccent}
                    onChange={(e) => setTitleAccent(e.target.value)}
                    placeholder="Tuỳ chọn (vd. Mùa 1, 2026)"
                    className="h-10 w-full rounded-btn border border-line-strong bg-black/25 px-4 text-base outline-none transition-colors focus:border-gold/70"
                  />
                </FieldRow>

                <FieldRow icon={FileText} label="Mô tả ngắn" htmlFor={`${uid}-description`}>
                  <div className="relative rounded-btn border border-line-strong bg-black/25 transition-colors focus-within:border-gold/70">
                    <textarea
                      id={`${uid}-description`}
                      value={description}
                      maxLength={DESC_MAX}
                      rows={2}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tóm tắt ngắn hiển thị trên thẻ giải đấu…"
                      className="block min-h-20 w-full resize-y bg-transparent px-4 pt-2 pb-6 text-base leading-snug outline-none"
                    />
                    <span className="pointer-events-none absolute right-4 bottom-2 text-sm text-fg-muted tabular">
                      {description.length}/{DESC_MAX}
                    </span>
                  </div>
                </FieldRow>

                <FieldRow icon={ScrollText} label="Đoạn giới thiệu" htmlFor={`${uid}-intro`}>
                  <textarea
                    id={`${uid}-intro`}
                    value={introText}
                    rows={4}
                    onChange={(e) => setIntroText(e.target.value)}
                    placeholder="Mỗi dòng là một đoạn giới thiệu ở trang chi tiết giải…"
                    className="block min-h-24 w-full resize-y rounded-btn border border-line-strong bg-black/25 px-4 py-2 text-base leading-snug outline-none transition-colors focus:border-gold/70"
                  />
                  <p className="mt-2 text-xs text-fg-muted">Mỗi dòng sẽ hiển thị thành một đoạn trong trang chi tiết giải.</p>
                </FieldRow>

                <FieldRow icon={ImageIcon} label="Ảnh bìa" as="fieldset">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {COVERS.map((c) => {
                      const on = cover === c.id
                      return (
                        <label
                          key={c.id}
                          className={cn(
                            'group relative flex cursor-pointer flex-col overflow-hidden rounded-btn border transition-colors',
                            'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold',
                            on ? 'border-gold/80 bg-gold-tint/60' : 'border-line-strong bg-black/20 hover:border-white/30',
                          )}
                        >
                          <input
                            type="radio"
                            name="cover"
                            value={c.id}
                            checked={on}
                            onChange={() => setCover(c.id)}
                            className="sr-only"
                          />
                          <div className="aspect-video w-full overflow-hidden">
                            <img src={c.src} alt="" className="size-full scale-125 origin-bottom-right object-cover" />
                          </div>
                          <span className="flex items-center justify-between px-3 py-2 text-sm font-medium">
                            <span>{c.label}</span>
                            {on && (
                              <span aria-hidden className="grid size-5 place-items-center rounded-full bg-gold text-gold-ink">
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </FieldRow>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="mt-1 text-base text-fg/85">Chọn quy mô số đội tham gia và thể thức thi đấu cho các trận.</p>
              <div className="mt-6 flex flex-col gap-6">
                <FieldRow icon={UsersRound} label="Số đội tham gia" as="fieldset">
                  <OptionCards
                    name="team-count"
                    value={String(teamCount) as `${TeamCount}`}
                    onChange={(v) => setTeamCount(Number(v) as TeamCount)}
                    className="grid-cols-1 sm:grid-cols-3"
                    options={TEAM_COUNTS}
                  />
                </FieldRow>

                <FieldRow icon={Repeat} label="Thể thức trận" as="fieldset">
                  <OptionCards
                    name="series"
                    value={series}
                    onChange={setSeries}
                    className="grid-cols-1 sm:grid-cols-3"
                    options={SERIES_OPTIONS}
                  />
                </FieldRow>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="mt-1 text-base text-fg/85">
                Thiết lập các mốc thời gian. Thứ tự phải đảm bảo: Hạn đăng ký ≤ Bốc thăm ≤ Bắt đầu ≤ Kết thúc.
              </p>
              <div className="mt-6 flex flex-col gap-6">
                <DateField
                  id={`${uid}-registrationDeadline`}
                  label="Hạn đăng ký"
                  value={registrationDeadline}
                  error={errors.registrationDeadline}
                  onChange={(v) => {
                    setRegistrationDeadline(v)
                    clearScheduleErrors()
                  }}
                />
                <DateField
                  id={`${uid}-drawDate`}
                  label="Ngày bốc thăm"
                  value={drawDate}
                  error={errors.drawDate}
                  onChange={(v) => {
                    setDrawDate(v)
                    clearScheduleErrors()
                  }}
                />
                <DateField
                  id={`${uid}-dateStart`}
                  label="Ngày bắt đầu"
                  value={dateStart}
                  error={errors.dateStart}
                  onChange={(v) => {
                    setDateStart(v)
                    clearScheduleErrors()
                  }}
                />
                <DateField
                  id={`${uid}-dateEnd`}
                  label="Ngày kết thúc"
                  value={dateEnd}
                  error={errors.dateEnd}
                  onChange={(v) => {
                    setDateEnd(v)
                    clearScheduleErrors()
                  }}
                />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <p className="mt-1 text-base text-fg/85">
                Thiết lập luật thi đấu, cơ cấu giải thưởng và kiểm tra lại toàn bộ thông tin trước khi tạo giải.
              </p>

              <div className="mt-6 flex flex-col gap-8">
                {/* Luật thi đấu */}
                <section aria-labelledby={`${uid}-rules-heading`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 id={`${uid}-rules-heading`} className="flex items-center gap-2 text-lg font-semibold">
                      <ScrollText size={20} aria-hidden className="text-gold" />
                      Luật thi đấu
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus size={16} aria-hidden />}
                      onClick={() => setRules((prev) => [...prev, ''])}
                    >
                      Thêm luật
                    </Button>
                  </div>
                  {rules.length === 0 ? (
                    <p className="mt-3 text-sm text-fg-muted">Chưa có điều luật nào. Bấm “Thêm luật” nếu muốn bổ sung.</p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-3">
                      {rules.map((rule, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <label htmlFor={`${uid}-rule-${idx}`} className="sr-only">
                            Điều luật {idx + 1}
                          </label>
                          <input
                            id={`${uid}-rule-${idx}`}
                            value={rule}
                            onChange={(e) => {
                              const value = e.target.value
                              setRules((prev) => prev.map((item, i) => (i === idx ? value : item)))
                            }}
                            placeholder={`Điều luật ${idx + 1}…`}
                            className="h-10 min-w-0 flex-1 rounded-btn border border-line-strong bg-black/25 px-4 text-base outline-none transition-colors focus:border-gold/70"
                          />
                          <IconButton
                            label={`Xoá điều luật ${idx + 1}`}
                            variant="ghost"
                            className="size-10 shrink-0"
                            onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={16} aria-hidden />
                          </IconButton>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Giải thưởng */}
                <section aria-labelledby={`${uid}-prizes-heading`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 id={`${uid}-prizes-heading`} className="flex items-center gap-2 text-lg font-semibold">
                      <Award size={20} aria-hidden className="text-gold" />
                      Giải thưởng
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus size={16} aria-hidden />}
                      onClick={() => setPrizes((prev) => [...prev, { place: '', reward: '' }])}
                    >
                      Thêm giải thưởng
                    </Button>
                  </div>
                  {prizes.length === 0 ? (
                    <p className="mt-3 text-sm text-fg-muted">Chưa có giải thưởng nào. Bấm “Thêm giải thưởng” để thêm.</p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-3">
                      {prizes.map((prize, idx) => {
                        const placeErr = errors[`prizes.${idx}.place`]
                        const rewardErr = errors[`prizes.${idx}.reward`]
                        return (
                          <li key={idx} className="flex flex-col gap-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <div className="min-w-0 sm:w-44">
                                <label htmlFor={`${uid}-prize-place-${idx}`} className="sr-only">
                                  Thứ hạng {idx + 1}
                                </label>
                                <input
                                  id={`${uid}-prize-place-${idx}`}
                                  value={prize.place}
                                  aria-invalid={placeErr ? true : undefined}
                                  aria-describedby={placeErr ? `${uid}-prize-place-${idx}-err` : undefined}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setPrizes((prev) => prev.map((item, i) => (i === idx ? { ...item, place: value } : item)))
                                    if (value.trim()) clearError(`prizes.${idx}.place`)
                                  }}
                                  placeholder="Thứ hạng (vd. Hạng 1)"
                                  className={cn(
                                    'h-10 w-full rounded-btn border bg-black/25 px-4 text-base outline-none transition-colors focus:border-gold/70',
                                    placeErr ? 'border-danger' : 'border-line-strong',
                                  )}
                                />
                              </div>
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <label htmlFor={`${uid}-prize-reward-${idx}`} className="sr-only">
                                  Phần thưởng {idx + 1}
                                </label>
                                <input
                                  id={`${uid}-prize-reward-${idx}`}
                                  value={prize.reward}
                                  aria-invalid={rewardErr ? true : undefined}
                                  aria-describedby={rewardErr ? `${uid}-prize-reward-${idx}-err` : undefined}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setPrizes((prev) => prev.map((item, i) => (i === idx ? { ...item, reward: value } : item)))
                                    if (value.trim()) clearError(`prizes.${idx}.reward`)
                                  }}
                                  placeholder="Phần thưởng (vd. 1.000.000đ + Cúp)"
                                  className={cn(
                                    'h-10 min-w-0 flex-1 rounded-btn border bg-black/25 px-4 text-base outline-none transition-colors focus:border-gold/70',
                                    rewardErr ? 'border-danger' : 'border-line-strong',
                                  )}
                                />
                                <IconButton
                                  label={`Xoá giải thưởng ${idx + 1}`}
                                  variant="ghost"
                                  className="size-10 shrink-0"
                                  onClick={() => {
                                    setPrizes((prev) => prev.filter((_, i) => i !== idx))
                                    clearError(`prizes.${idx}.place`)
                                    clearError(`prizes.${idx}.reward`)
                                  }}
                                >
                                  <Trash2 size={16} aria-hidden />
                                </IconButton>
                              </div>
                            </div>
                            {(placeErr || rewardErr) && (
                              <div className="flex flex-col gap-1 text-sm text-danger">
                                {placeErr && (
                                  <p id={`${uid}-prize-place-${idx}-err`} role="alert">
                                    {placeErr}
                                  </p>
                                )}
                                {rewardErr && (
                                  <p id={`${uid}-prize-reward-${idx}-err`} role="alert">
                                    {rewardErr}
                                  </p>
                                )}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                {/* Xem lại */}
                <section aria-labelledby={`${uid}-review-heading`} className="border-t border-line-strong/70 pt-6">
                  <h3 id={`${uid}-review-heading`} className="flex items-center gap-2 text-lg font-semibold">
                    <ClipboardCheck size={20} aria-hidden className="text-gold" />
                    Xem lại thông tin
                  </h3>
                  <div className="mt-4 flex flex-col gap-4">
                    <ReviewGroup title="Thông tin giải" onEdit={() => goTo(1)}>
                      <ReviewItem label="Tên giải đấu" value={name.trim() || '—'} />
                      <ReviewItem label="Tiêu đề nhấn" value={titleAccent.trim() || 'Không có'} />
                      <ReviewItem label="Ảnh bìa" value={activeCover.label} />
                      <ReviewItem label="Mô tả ngắn" value={description.trim() || 'Không có'} multiline />
                    </ReviewGroup>
                    <ReviewGroup title="Thể thức" onEdit={() => goTo(2)}>
                      <ReviewItem label="Số đội" value={`${teamCount} đội`} />
                      <ReviewItem label="Thể thức trận" value={series} />
                    </ReviewGroup>
                    <ReviewGroup title="Lịch thi đấu" onEdit={() => goTo(3)}>
                      <ReviewItem label="Hạn đăng ký" value={formatDateTimeDisplay(registrationDeadline)} />
                      <ReviewItem label="Ngày bốc thăm" value={formatDateTimeDisplay(drawDate)} />
                      <ReviewItem label="Ngày bắt đầu" value={formatDateTimeDisplay(dateStart)} />
                      <ReviewItem label="Ngày kết thúc" value={formatDateTimeDisplay(dateEnd)} />
                    </ReviewGroup>
                    <ReviewSummaryGroup title="Luật & giải thưởng">
                      <ReviewItem
                        label="Số điều luật"
                        value={activeRules.length ? `${activeRules.length} điều luật` : 'Không có'}
                      />
                      <ReviewItem
                        label="Giải thưởng"
                        value={
                          prizes.length
                            ? prizes.map((p) => `${p.place || '—'}: ${p.reward || '—'}`).join(' · ')
                            : 'Không có'
                        }
                      />
                    </ReviewSummaryGroup>
                  </div>
                </section>
              </div>
            </>
          )}

          {/*
            Thanh hành động: < 768 dính đáy (ngay trên BottomNav), ≥ 768 nằm cuối form.
            Nút vàng đặc duy nhất của màn: "Tiếp tục" / "Tạo giải".
          */}
          {submitError && (
            <p role="alert" className="mt-6 rounded-btn border border-danger px-4 py-3 text-sm text-danger">
              {submitError}
            </p>
          )}
          <div className="sticky bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-10 -mx-4 mt-6 flex items-center gap-3 border-t border-line-strong/70 bg-surface px-4 py-3 md:static md:mx-0 md:mt-auto md:bg-transparent md:px-0 md:py-4">
            {step > 1 ? (
              <Button variant="ghost" leftIcon={<ArrowLeft size={18} aria-hidden />} onClick={() => goTo((step - 1) as Step)}>
                Quay lại
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate('/tournaments')}>
                Hủy
              </Button>
            )}
            <div className="ml-auto flex items-center gap-3">
              {step > 1 && (
                <div className="hidden sm:block">
                  <Button variant="outline" onClick={() => navigate('/tournaments')}>
                    Hủy
                  </Button>
                </div>
              )}
              <Button
                type="submit"
                disabled={submitting}
                className="min-w-32"
                leftIcon={step === 4 ? <Check size={18} aria-hidden /> : undefined}
                rightIcon={step < 4 ? <ArrowRight size={18} aria-hidden /> : undefined}
              >
                {step < 4 ? 'Tiếp tục' : submitting ? 'Đang tạo…' : 'Tạo giải'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function DateField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <FieldRow icon={CalendarDays} label={label} required htmlFor={id}>
      <input
        id={id}
        type="datetime-local"
        value={value}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 w-full max-w-sm rounded-btn border bg-black/25 px-4 text-base outline-none transition-colors focus:border-gold/70',
          error ? 'border-danger' : 'border-line-strong',
        )}
      />
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </FieldRow>
  )
}

function FieldRow({
  icon: Icon,
  label,
  required,
  htmlFor,
  as = 'div',
  className,
  children,
}: {
  icon: LucideIcon
  label: string
  required?: boolean
  htmlFor?: string
  as?: 'div' | 'fieldset'
  className?: string
  children: ReactNode
}) {
  const labelContent = (
    <>
      <Icon size={20} aria-hidden strokeWidth={1.7} className="text-gold" />
      <span>
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (bắt buộc)</span>}
      </span>
    </>
  )
  const labelCls = 'flex min-h-10 shrink-0 items-center gap-3 text-base font-medium md:w-44'
  if (as === 'fieldset') {
    return (
      <fieldset className={cn('flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:gap-0', className)}>
        <legend className="sr-only">{label}</legend>
        <span aria-hidden className={labelCls}>
          {labelContent}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </fieldset>
    )
  }
  return (
    <div className={cn('flex flex-col gap-2 md:flex-row md:items-start md:gap-0', className)}>
      <label htmlFor={htmlFor} className={labelCls}>
        {labelContent}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function OptionCards<T extends string>({
  name,
  value,
  onChange,
  options,
  className,
}: {
  name: string
  value: T
  onChange: (v: T) => void
  options: Array<{ id: T; title: string; sub: string; icon?: LucideIcon }>
  className?: string
}) {
  return (
    <div className={cn('grid gap-3', className)}>
      {options.map(({ id, title, sub, icon: Icon }) => {
        const on = value === id
        return (
          <label
            key={id}
            className={cn(
              'relative flex min-h-16 min-w-0 cursor-pointer items-center gap-3 rounded-btn border py-2 pr-8 pl-3 transition-colors',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold',
              on
                ? 'border-gold/80 bg-[linear-gradient(135deg,rgb(242_180_99/0.16),rgb(242_180_99/0.04))]'
                : 'border-line-strong bg-black/20 hover:border-white/30',
            )}
          >
            <input type="radio" name={name} value={id} checked={on} onChange={() => onChange(id)} className="sr-only" />
            {Icon && <Icon size={24} aria-hidden strokeWidth={1.6} className={cn('shrink-0', on ? 'text-gold' : 'text-fg')} />}
            <span className="min-w-0">
              <span className="block text-base font-medium">{title}</span>
              <span className="block text-xs text-fg-muted">{sub}</span>
            </span>
            {on && (
              <span aria-hidden className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-gold text-gold-ink">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </label>
        )
      })}
    </div>
  )
}

function ReviewGroup({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rounded-btn border border-line bg-surface-2/60 p-4" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-base font-semibold">{title}</h4>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Pencil size={14} aria-hidden />}
          onClick={onEdit}
          aria-label={`Sửa ${title.toLowerCase()}`}
        >
          Sửa
        </Button>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function ReviewSummaryGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-btn border border-line bg-surface-2/60 p-4" aria-label={title}>
      <h4 className="text-base font-semibold">{title}</h4>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function ReviewItem({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={cn('min-w-0', multiline && 'sm:col-span-2')}>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={cn('mt-1 text-sm break-words', multiline && 'whitespace-pre-line')}>{value}</dd>
    </div>
  )
}
