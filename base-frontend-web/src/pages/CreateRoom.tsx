import { useId, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileText,
  Gamepad2,
  Gift,
  Map as MapIcon,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Repeat,
  Scale,
  Settings,
  Shuffle,
  SlidersHorizontal,
  SquarePen,
  Swords,
  Trophy,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useToast } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/layout/PageHeader'

type Step = 1 | 2 | 3 | 4
type Mode = 'normal' | 'tournament' | 'friendly' | 'other'
type Visibility = 'public' | 'private'
type TeamSize = '5v5' | '3v3' | '1v1'
type PickRule = 'draft' | 'blind' | 'random'
type Series = 'BO1' | 'BO3' | 'BO5'
type BalanceBy = 'random' | 'tier'
type ToolId = 'balance' | 'lane' | 'champion' | 'mystery' | 'chat'

const STEPS: Array<{ n: Step; label: string; icon: LucideIcon }> = [
  { n: 1, label: 'Thông tin phòng', icon: SquarePen },
  { n: 2, label: 'Cấu hình trận', icon: Gamepad2 },
  { n: 3, label: 'Công cụ hỗ trợ', icon: Wrench },
  { n: 4, label: 'Xem lại', icon: ClipboardCheck },
]

const MODES: Array<{ id: Mode; icon: LucideIcon; title: string; sub: string }> = [
  { id: 'normal', icon: UsersRound, title: 'Đấu thường', sub: '5v5 · Tùy chỉnh' },
  { id: 'tournament', icon: Trophy, title: 'Giải đấu', sub: 'Có bảng đấu, xếp hạng' },
  { id: 'friendly', icon: Swords, title: 'Giao hữu', sub: 'Thi đấu linh hoạt' },
  { id: 'other', icon: Settings, title: 'Khác', sub: 'Tùy chỉnh nâng cao' },
]

const TEAM_SIZES: Array<{ id: TeamSize; title: string; sub: string }> = [
  { id: '5v5', title: '5 vs 5', sub: '10 người chơi' },
  { id: '3v3', title: '3 vs 3', sub: '6 người chơi' },
  { id: '1v1', title: '1 vs 1', sub: 'Solo, 2 người' },
]

const MAPS: Record<TeamSize, string[]> = {
  '5v5': ['Đấu trường 5v5 (3 đường)', 'Hỗn chiến 1 đường'],
  '3v3': ['Đấu trường 3v3'],
  '1v1': ['Đấu trường 1v1 (Solo)'],
}

const PICK_RULES: Array<{ id: PickRule; title: string; sub: string }> = [
  { id: 'draft', title: 'Cấm / chọn (Draft)', sub: 'Lần lượt cấm rồi chọn tướng' },
  { id: 'blind', title: 'Chọn ẩn (Blind)', sub: 'Hai đội chọn cùng lúc, không cấm' },
  { id: 'random', title: 'Ngẫu nhiên toàn bộ', sub: 'Hệ thống bốc tướng cho mọi người' },
]

const SERIES: Array<{ id: Series; title: string; sub: string }> = [
  { id: 'BO1', title: 'BO1', sub: '1 ván' },
  { id: 'BO3', title: 'BO3', sub: 'Thắng 2 ván' },
  { id: 'BO5', title: 'BO5', sub: 'Thắng 3 ván' },
]

const BANS = ['0', '2', '3', '4'] as const

const TOOLS: Array<{ id: ToolId; icon: LucideIcon; title: string; desc: string }> = [
  { id: 'balance', icon: Scale, title: 'Chia đội', desc: 'Chủ phòng bấm "Chia lại" để chia hai đội.' },
  { id: 'lane', icon: Shuffle, title: 'Random lane', desc: 'Phân vị trí ngẫu nhiên cho từng người.' },
  { id: 'champion', icon: RefreshCw, title: 'Random tướng', desc: 'Bốc tướng ngẫu nhiên theo lane.' },
  { id: 'mystery', icon: Gift, title: 'Hộp bí ẩn', desc: 'Thử thách / skin ngẫu nhiên cho vui.' },
  { id: 'chat', icon: MessageSquareText, title: 'Chat phòng', desc: 'Khung chat cho người trong phòng.' },
]

const NAME_MAX = 50
const DESC_MAX = 200

export default function CreateRoom() {
  const navigate = useNavigate()
  const { notify } = useToast()
  const uid = useId()

  const [step, setStep] = useState<Step>(1)
  /** Bước xa nhất đã tới — chỉ cho bấm stepper tới các bước đã mở */
  const [reached, setReached] = useState<Step>(1)

  // Bước 1
  const [name, setName] = useState('Kèo giao hữu – Team A vs Team B')
  const [desc, setDesc] = useState('Giao hữu vui vẻ, full đội 5v5.\nƯu tiên đúng giờ và giữ fair-play.')
  const [mode, setMode] = useState<Mode>('normal')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [spectators, setSpectators] = useState(true)
  const [maxSpectators, setMaxSpectators] = useState('20')
  const [nameError, setNameError] = useState<string | null>(null)
  // Bước 2
  const [teamSize, setTeamSize] = useState<TeamSize>('5v5')
  const [map, setMap] = useState(MAPS['5v5'][0])
  const [pickRule, setPickRule] = useState<PickRule>('draft')
  const [bans, setBans] = useState<(typeof BANS)[number]>('2')
  const [series, setSeries] = useState<Series>('BO1')
  // Bước 3
  const [tools, setTools] = useState<Record<ToolId, boolean>>({
    balance: true,
    lane: true,
    champion: false,
    mystery: false,
    chat: true,
  })
  const [balanceBy, setBalanceBy] = useState<BalanceBy>('random')

  const validateStep1 = (): boolean => {
    if (!name.trim()) {
      setNameError('Vui lòng nhập tên phòng (tối đa 50 ký tự).')
      document.getElementById(`${uid}-name`)?.focus()
      return false
    }
    setNameError(null)
    return true
  }

  const goTo = (target: Step) => {
    if (target > 1 && step === 1 && !validateStep1()) return
    setStep(target)
    setReached((r) => (target > r ? target : r))
    // Đổi bước → đưa đầu form vào khung nhìn (quan trọng trên mobile)
    document.getElementById(`${uid}-step-title`)?.scrollIntoView({ block: 'nearest' })
  }

  const changeTeamSize = (s: TeamSize) => {
    setTeamSize(s)
    if (!MAPS[s].includes(map)) setMap(MAPS[s][0])
  }

  const create = () => {
    if (!validateStep1()) {
      setStep(1)
      return
    }
    notify('Đã tạo phòng (giả lập)', `${name.trim()} · ${teamSize} · ${series}. Chức năng tạo phòng thật sẽ có khi nối backend.`)
  }

  const modeInfo = MODES.find((m) => m.id === mode)!
  const pickInfo = PICK_RULES.find((p) => p.id === pickRule)!
  const enabledTools = TOOLS.filter((t) => tools[t.id])

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Tạo phòng custom"
        description="Thiết lập phòng đấu theo ý muốn, tùy chỉnh chế độ, luật chơi và các công cụ hỗ trợ cho trận đấu."
      />

      {/* Không dùng overflow-hidden ở khung này: sẽ làm hỏng thanh hành động sticky trên mobile */}
      <div className="mt-6 grid grid-cols-1 rounded-card border border-line-strong/70 bg-surface/90 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Stepper: ngang < 1024px, dọc ≥ 1024px */}
        <nav
          aria-label="Các bước tạo phòng"
          className="relative overflow-x-auto border-b border-line-strong/70 p-3 lg:border-r lg:border-b-0 lg:p-4"
        >
          <ol className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-0">
            {STEPS.map((s, i) => {
              const active = s.n === step
              // Đã đi qua (kể cả khi quay lại bước trước để sửa)
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
                    {/*
                      Nhãn: < 640 chỉ có số (tiêu đề form đã nêu tên bước); 640–1023 chỉ nhãn bước đang làm;
                      ≥ 1024 (stepper dọc) đủ 4 nhãn. Không để nhãn xuống dòng (Còn tồn #3).
                    */}
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

        {/* Nội dung bước */}
        <form
          noValidate
          aria-labelledby={`${uid}-step-title`}
          className="flex min-w-0 flex-col px-4 pt-4 md:px-6 lg:pt-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (step < 4) goTo((step + 1) as Step)
            else create()
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
              <p className="mt-1 text-base text-fg/85">Nhập các thông tin cơ bản và tùy chọn hiển thị cho phòng đấu.</p>

              <div className="mt-6 flex flex-col gap-6">
                <FieldRow icon={SquarePen} label="Tên phòng" required htmlFor={`${uid}-name`}>
                  <div
                    className={cn(
                      'flex h-10 items-center gap-3 rounded-btn border bg-black/25 px-4 transition-colors focus-within:border-gold/70',
                      nameError ? 'border-danger' : 'border-line-strong',
                    )}
                  >
                    <input
                      id={`${uid}-name`}
                      value={name}
                      maxLength={NAME_MAX}
                      required
                      aria-invalid={nameError ? true : undefined}
                      aria-describedby={nameError ? `${uid}-name-err` : undefined}
                      onChange={(e) => {
                        setName(e.target.value)
                        if (nameError && e.target.value.trim()) setNameError(null)
                      }}
                      className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
                    />
                    <span className="shrink-0 text-sm text-fg-muted tabular" aria-live="polite">
                      {name.length}/{NAME_MAX}
                    </span>
                  </div>
                  {nameError && (
                    <p id={`${uid}-name-err`} role="alert" className="mt-2 text-sm text-danger">
                      {nameError}
                    </p>
                  )}
                </FieldRow>

                <FieldRow icon={FileText} label="Mô tả phòng" htmlFor={`${uid}-desc`}>
                  <div className="relative rounded-btn border border-line-strong bg-black/25 transition-colors focus-within:border-gold/70">
                    <textarea
                      id={`${uid}-desc`}
                      value={desc}
                      maxLength={DESC_MAX}
                      rows={3}
                      onChange={(e) => setDesc(e.target.value)}
                      className="block min-h-20 w-full resize-y bg-transparent px-4 pt-2 pb-6 text-base leading-snug outline-none"
                    />
                    <span className="pointer-events-none absolute right-4 bottom-2 text-sm text-fg-muted tabular">
                      {desc.length}/{DESC_MAX}
                    </span>
                  </div>
                </FieldRow>

                <FieldRow icon={Gamepad2} label="Chế độ phòng" as="fieldset">
                  <OptionCards
                    name="mode"
                    value={mode}
                    onChange={setMode}
                    className="grid-cols-2 2xl:grid-cols-4"
                    options={MODES.map(({ id, icon, title, sub }) => ({ id, icon, title, sub }))}
                  />
                </FieldRow>

                <FieldRow icon={Eye} label="Hiển thị phòng" as="fieldset">
                  <OptionCards
                    name="visibility"
                    value={visibility}
                    onChange={setVisibility}
                    className="grid-cols-1 sm:grid-cols-2"
                    options={[
                      { id: 'public', title: 'Công khai', sub: 'Hiển thị trên danh sách phòng, bất kỳ ai cũng có thể tham gia' },
                      { id: 'private', title: 'Riêng tư', sub: 'Chỉ những người có mã phòng hoặc được mời mới có thể tham gia' },
                    ]}
                  />
                </FieldRow>
              </div>

              <div className="mt-6 border-t border-line-strong/70 pt-4">
                <p className="flex items-center gap-3 text-base font-medium">
                  <SlidersHorizontal size={20} aria-hidden className="text-gold" />
                  Khán giả
                </p>
                <div className="mt-3 flex flex-col gap-3 md:pl-8">
                  <Toggle
                    checked={spectators}
                    onChange={setSpectators}
                    title="Cho phép khán giả"
                    desc="Cho phép người khác vào phòng ở chế độ quan sát."
                  />
                  {/* Chỉ hiện khi đang bật khán giả */}
                  {spectators && (
                    <label className="flex flex-col gap-2 md:pl-16">
                      <span className="text-sm text-fg-muted">Số khán giả tối đa</span>
                      <span className="relative flex h-10 w-full max-w-56 items-center rounded-btn border border-line-strong bg-black/25 transition-colors focus-within:border-gold/70">
                        <Eye size={18} aria-hidden className="pointer-events-none absolute left-4 text-fg" />
                        <select
                          value={maxSpectators}
                          onChange={(e) => setMaxSpectators(e.target.value)}
                          className="h-full w-full appearance-none bg-transparent pr-8 pl-12 text-sm outline-none"
                        >
                          {['10', '20', '50'].map((n) => (
                            <option key={n} value={n} className="bg-surface-2">
                              Tối đa {n} người
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3" />
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="mt-1 text-base text-fg/85">Thiết lập số người, luật cấm/chọn, bản đồ và thể thức cho trận đấu.</p>
              <div className="mt-6 flex flex-col gap-6">
                <FieldRow icon={UsersRound} label="Số người" as="fieldset">
                  <OptionCards
                    name="team-size"
                    value={teamSize}
                    onChange={changeTeamSize}
                    className="grid-cols-1 sm:grid-cols-3"
                    options={TEAM_SIZES}
                  />
                </FieldRow>
                <FieldRow icon={Ban} label="Luật cấm/chọn" as="fieldset">
                  <OptionCards
                    name="pick-rule"
                    value={pickRule}
                    onChange={setPickRule}
                    className="grid-cols-1 sm:grid-cols-3"
                    options={PICK_RULES}
                  />
                  {pickRule === 'draft' && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span id={`${uid}-bans`} className="text-sm text-fg-muted">
                        Số lượt cấm mỗi đội
                      </span>
                      <div role="radiogroup" aria-labelledby={`${uid}-bans`} className="flex gap-2">
                        {BANS.map((b) => (
                          <label
                            key={b}
                            className={cn(
                              'grid h-10 min-w-11 cursor-pointer place-items-center rounded-btn border px-3 text-sm font-semibold tabular transition-colors',
                              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold',
                              bans === b ? 'border-gold/80 bg-gold-tint text-gold' : 'border-line-strong hover:border-white/30',
                            )}
                          >
                            <input type="radio" name="bans" value={b} checked={bans === b} onChange={() => setBans(b)} className="sr-only" />
                            {b}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </FieldRow>
                <FieldRow icon={MapIcon} label="Bản đồ" htmlFor={`${uid}-map`}>
                  <span className="relative flex h-10 w-full max-w-sm items-center rounded-btn border border-line-strong bg-black/25 transition-colors focus-within:border-gold/70">
                    <select
                      id={`${uid}-map`}
                      value={map}
                      onChange={(e) => setMap(e.target.value)}
                      className="h-full w-full appearance-none bg-transparent pr-8 pl-4 text-sm outline-none"
                    >
                      {MAPS[teamSize].map((m) => (
                        <option key={m} value={m} className="bg-surface-2">
                          {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3" />
                  </span>
                  <p className="mt-2 text-xs text-fg-muted">Danh sách bản đồ đổi theo số người.</p>
                </FieldRow>
                <FieldRow icon={Repeat} label="Thể thức" as="fieldset">
                  <OptionCards name="series" value={series} onChange={setSeries} className="grid-cols-3" options={SERIES} />
                </FieldRow>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="mt-1 text-base text-fg/85">Chọn các công cụ sẽ bật trong phòng. Chỉ chủ phòng dùng được công cụ chia đội và random.</p>
              <ul className="mt-6 flex flex-col">
                {TOOLS.map(({ id, icon: Icon, title, desc: d }, i) => (
                  <li key={id} className={cn('flex flex-col gap-3 py-4', i > 0 && 'border-t border-line')}>
                    <div className="flex items-start gap-4">
                      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-btn bg-surface-3 text-gold">
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Toggle
                          checked={tools[id]}
                          onChange={(v) => setTools((t) => ({ ...t, [id]: v }))}
                          title={title}
                          desc={d}
                          reverse
                        />
                      </div>
                    </div>
                    {id === 'balance' && tools.balance && (
                      <fieldset className="md:pl-14">
                        <legend className="text-sm text-fg-muted">Cách chia đội mặc định</legend>
                        <OptionCards
                          name="balance-by"
                          value={balanceBy}
                          onChange={setBalanceBy}
                          className="mt-2 grid-cols-1 sm:grid-cols-2"
                          options={[
                            { id: 'random', title: 'Ngẫu nhiên', sub: 'Chia 5v5 ngẫu nhiên' },
                            { id: 'tier', title: 'Cân bằng theo Tier', sub: 'Cần người chơi khai báo mâm/tier' },
                          ]}
                        />
                      </fieldset>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 4 && (
            <>
              <p className="mt-1 text-base text-fg/85">Kiểm tra lại trước khi tạo phòng. Bấm "Sửa" để quay lại bước tương ứng.</p>
              <div className="mt-6 flex flex-col gap-4">
                <ReviewGroup title="Thông tin phòng" onEdit={() => goTo(1)}>
                  <ReviewItem label="Tên phòng" value={name.trim() || '—'} />
                  <ReviewItem label="Mô tả" value={desc.trim() || 'Không có'} multiline />
                  <ReviewItem label="Chế độ" value={modeInfo.title} />
                  <ReviewItem label="Hiển thị" value={visibility === 'private' ? 'Riêng tư (cần mã phòng)' : 'Công khai'} />
                  <ReviewItem label="Khán giả" value={spectators ? `Cho phép, tối đa ${maxSpectators} người` : 'Không cho phép'} />
                </ReviewGroup>
                <ReviewGroup title="Cấu hình trận" onEdit={() => goTo(2)}>
                  <ReviewItem label="Số người" value={TEAM_SIZES.find((t) => t.id === teamSize)!.title} />
                  <ReviewItem
                    label="Cấm/chọn"
                    value={pickRule === 'draft' ? `${pickInfo.title} · ${bans} lượt cấm/đội` : pickInfo.title}
                  />
                  <ReviewItem label="Bản đồ" value={map} />
                  <ReviewItem label="Thể thức" value={series} />
                </ReviewGroup>
                <ReviewGroup title="Công cụ hỗ trợ" onEdit={() => goTo(3)}>
                  <ReviewItem
                    label="Đang bật"
                    value={
                      enabledTools.length
                        ? enabledTools
                            .map((t) =>
                              t.id === 'balance' ? `${t.title} (${balanceBy === 'tier' ? 'theo Tier' : 'ngẫu nhiên'})` : t.title,
                            )
                            .join(', ')
                        : 'Không bật công cụ nào'
                    }
                  />
                </ReviewGroup>
              </div>
            </>
          )}

          {/*
            Thanh hành động: < 768 dính đáy (ngay trên BottomNav), ≥ 768 nằm cuối form.
            Nút vàng đặc duy nhất của màn: "Tiếp tục" / "Tạo phòng".
          */}
          <div className="sticky bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-10 -mx-4 mt-6 flex items-center gap-3 border-t border-line-strong/70 bg-surface px-4 py-3 md:static md:mx-0 md:mt-auto md:bg-transparent md:px-0 md:py-4">
            {step > 1 ? (
              <Button variant="ghost" leftIcon={<ArrowLeft size={18} aria-hidden />} onClick={() => goTo((step - 1) as Step)}>
                Quay lại
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Hủy
              </Button>
            )}
            <div className="ml-auto flex items-center gap-3">
              {step > 1 && (
                // Bọc div để ẩn theo breakpoint (Button có sẵn inline-flex, đặt `hidden` cùng phần tử sẽ thua)
                <div className="hidden sm:block">
                  <Button variant="outline" onClick={() => navigate('/dashboard')}>
                    Hủy
                  </Button>
                </div>
              )}
              <Button
                type="submit"
                className="min-w-32"
                leftIcon={step === 4 ? <Check size={18} aria-hidden /> : undefined}
                rightIcon={step < 4 ? <ArrowRight size={18} aria-hidden /> : undefined}
              >
                {step < 4 ? 'Tiếp tục' : 'Tạo phòng'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
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

/** Nhóm thẻ lựa chọn (radio) — dùng cho chế độ, hiển thị, số người, luật chọn, thể thức */
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
        <h3 className="text-base font-semibold">{title}</h3>
        <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} aria-hidden />} onClick={onEdit} aria-label={`Sửa ${title.toLowerCase()}`}>
          Sửa
        </Button>
      </div>
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

function Toggle({
  checked,
  onChange,
  title,
  desc,
  reverse,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  desc: string
  /** Chữ bên trái, công tắc bên phải (danh sách công cụ) */
  reverse?: boolean
}) {
  const id = useId()
  return (
    <div className={cn('flex items-center gap-4', reverse && 'flex-row-reverse justify-between')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        onClick={() => onChange(!checked)}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-gold' : 'bg-surface-4')}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-1 left-1 size-5 rounded-full shadow transition-transform duration-200 ease-[var(--ease-out-soft)]',
            checked ? 'translate-x-5 bg-white' : 'bg-fg-muted',
          )}
        />
      </button>
      <div className="min-w-0">
        <p id={`${id}-t`} className="text-base font-medium">
          {title}
        </p>
        <p id={`${id}-d`} className="text-sm text-fg-muted">
          {desc}
        </p>
      </div>
    </div>
  )
}
