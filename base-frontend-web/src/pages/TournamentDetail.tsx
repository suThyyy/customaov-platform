import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  Bell,
  BellRing,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  Gamepad2,
  Gift,
  Info,
  LayoutGrid,
  ListOrdered,
  MoreHorizontal,
  Play,
  ScrollText,
  Share2,
  Trophy,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { cn } from '../lib/cn'
import {
  groupByDate,
  isReadyMatch,
  isScheduled,
  matchClock,
  matchProgress,
  podium,
  scheduleOf,
  standings,
  winnerOf,
  type StandingTone,
} from '../lib/tournament'
import { OrganizerPanel } from '../components/domain/OrganizerPanel'
import { useToast } from '../context/AppContext'
import { ListStatus, SkeletonCards, SkeletonRows } from '../components/ui/ListStatus'
import {
  DATA_SOURCE,
  TOURNAMENT_STATUS_LABEL,
  useTournament,
  type HookResult,
  type BracketMatch,
  type BracketRound,
  type ScheduledMatch,
  type Team,
  type TournamentDetail as Detail,
  type TournamentStatus,
} from '../api'
import { Button, ButtonLink, IconButton } from '../components/ui/Button'
import { Card, Eyebrow, SectionTitle, SeeAllLink } from '../components/ui/primitives'
import { Tabs } from '../components/ui/Tabs'
import { PageBanner } from '../components/domain/PageBanner'
import { EmptyState } from '../components/domain/EmptyState'
import { RegistrationProgress } from '../components/domain/RegistrationProgress'

type DetailTab = 'info' | 'teams' | 'bracket' | 'schedule' | 'results'

const TAB_ITEMS: Array<{ id: DetailTab; label: string; icon: ReactNode }> = [
  { id: 'info', label: 'Thông tin', icon: <Info size={18} /> },
  { id: 'teams', label: 'Danh sách đội', icon: <UsersRound size={18} /> },
  { id: 'bracket', label: 'Bảng đấu', icon: <LayoutGrid size={18} /> },
  { id: 'schedule', label: 'Lịch thi đấu', icon: <CalendarDays size={18} /> },
  { id: 'results', label: 'Kết quả', icon: <Trophy size={18} /> },
]

const isTab = (v: string | null): v is DetailTab => TAB_ITEMS.some((t) => t.id === v)

const PRIMARY_ACTION: Record<TournamentStatus, string> = {
  open: 'Đăng ký tham gia',
  live: 'Xem trận đang diễn ra',
  finished: 'Xem kết quả',
}

export default function TournamentDetail() {
  const { slug } = useParams()
  const load = useTournament(slug)
  const d = load.data
  if (load.status !== 'ready') {
    return (
      <ListStatus status={load.status} onRetry={load.retry} label="chi tiết giải đấu" className="mt-6" skeleton={<SkeletonCards count={1} />}>
        {null}
      </ListStatus>
    )
  }
  if (!d) {
    return (
      <EmptyState
        className="mt-6 min-h-96"
        icon={<Trophy size={28} />}
        as="h1"
        title="Không tìm thấy giải đấu"
        description="Giải đấu không tồn tại hoặc đã bị xóa."
        action={
          <ButtonLink to="/tournaments" variant="outline">
            Danh sách giải đấu
          </ButtonLink>
        }
      />
    )
  }
  return <TournamentView key={d.slug} d={d} load={load} />
}

/**
 * Chi tiết giải. Tab lưu trên URL (?tab=) để chia sẻ link / Back hoạt động.
 * Nút vàng đặc duy nhất: nút chính trên banner (đổi theo trạng thái giải).
 */
function TournamentView({ d, load }: { d: Detail; load: HookResult<Detail | undefined> }) {
  const { comingSoon, notify } = useToast()
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab')
  const tab: DetailTab = isTab(rawTab) ? rawTab : 'info'
  const setTab = (t: DetailTab) => setParams(t === 'info' ? {} : { tab: t })
  const [following, setFollowing] = useState(false)

  // TODO: nối API đăng ký giải khi có backend
  const register = () => comingSoon(`Đăng ký giải ${d.name}`)
  const onPrimary = () => (d.status === 'open' ? register() : setTab(d.status === 'live' ? 'bracket' : 'results'))

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      notify('Đã sao chép liên kết giải đấu')
    } catch {
      notify('Không thể sao chép', 'Trình duyệt chặn clipboard.')
    }
  }

  // Giữ từ cuối của tiêu đề dính với phần tô vàng: tránh "Ngũ Kiệt Cup – Mùa / 1"
  const words = d.title.split(' ')
  const lastWord = words.pop()

  return (
    <div className="flex flex-col pt-6">
      <PageBanner image={d.heroImage} className="min-h-60" imageClassName="object-[50%_30%]">
        <div className="flex flex-col px-4 py-6 sm:px-8">
          <Eyebrow>Custom AOV Community</Eyebrow>
          <h1 className="mt-2 font-display text-2xl leading-tight font-bold sm:text-4xl">
            {words.join(' ')}{' '}
            <span className="whitespace-nowrap">
              {lastWord}
              {d.titleAccent && (
                <>
                  {' '}
                  <span className="text-gold-gradient">{d.titleAccent}</span>
                </>
              )}
            </span>
          </h1>
          <p className="mt-2 max-w-[60ch] text-sm leading-normal text-fg/90">{d.intro.join(' ')}</p>
          <ul className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fg/90" aria-label="Thông tin nhanh">
            <li>
              <StatusPill status={d.status} />
            </li>
            {d.registeredTeams === undefined && (
              <li className="flex items-center gap-2">
                <UsersRound size={16} aria-hidden className="text-fg-muted" />
                {d.teamCount} đội
              </li>
            )}
            <li className="flex items-center gap-2">
              <CalendarDays size={16} aria-hidden className="text-fg-muted" />
              {d.dateRange}
            </li>
            <li className="flex items-center gap-2">
              <Gamepad2 size={16} aria-hidden className="text-fg-muted" />
              {d.mode}
            </li>
            <li className="flex items-center gap-2">
              <Trophy size={16} aria-hidden className="text-gold" />
              {d.category}
            </li>
          </ul>
          {d.registeredTeams !== undefined && (
            <RegistrationProgress registered={d.registeredTeams} total={d.teamCount} className="mt-4 max-w-sm" />
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              pill
              leftIcon={d.status === 'open' ? <UserPlus size={16} aria-hidden /> : <Play size={16} aria-hidden className="fill-current" />}
              onClick={onPrimary}
            >
              {PRIMARY_ACTION[d.status]}
            </Button>
            <Button
              pill
              variant="outline"
              aria-pressed={following}
              className={cn('bg-black/40 backdrop-blur-sm', following && 'border-gold/70! text-gold')}
              leftIcon={following ? <BellRing size={16} aria-hidden /> : <Bell size={16} aria-hidden />}
              onClick={() => {
                setFollowing((v) => !v)
                notify(
                  following ? 'Đã bỏ theo dõi giải đấu' : 'Đang theo dõi giải đấu',
                  following ? undefined : 'Bạn sẽ nhận thông báo khi có trận mới (giả lập).',
                )
              }}
            >
              {following ? 'Đang theo dõi' : 'Theo dõi'}
            </Button>
            <Button pill variant="outline" className="bg-black/40 backdrop-blur-sm" leftIcon={<Share2 size={16} aria-hidden />} onClick={share}>
              Chia sẻ
            </Button>
            <IconButton
              label="Thêm tùy chọn"
              className="size-10 rounded-full bg-black/40 backdrop-blur-sm"
              onClick={() => comingSoon('Tùy chọn giải đấu')}
            >
              <MoreHorizontal size={20} aria-hidden />
            </IconButton>
          </div>
        </div>
      </PageBanner>

      {d.myRole === 'organizer' && (
        <div className="mt-6">
          <OrganizerPanel d={d} onChanged={load.reload} />
        </div>
      )}

      <Tabs<DetailTab>
        label="Nội dung giải đấu"
        idPrefix="tour"
        value={tab}
        onChange={setTab}
        items={TAB_ITEMS}
        className="mt-4 h-12"
        itemClassName="px-4 text-base [&>span:first-child]:text-current"
      />

      <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${tab}`} className="mt-6">
        <ListStatus
          status={load.status}
          onRetry={load.retry}
          label={`nội dung "${TAB_ITEMS.find((t) => t.id === tab)?.label}"`}
          skeleton={tab === 'teams' ? <SkeletonCards count={3} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" /> : <SkeletonRows count={5} />}
        >
          {tab === 'info' && <InfoTab d={d} setTab={setTab} onContact={() => comingSoon(`Liên hệ ${d.organizer}`)} />}
          {tab === 'teams' && <TeamsTab d={d} onRegister={register} />}
          {tab === 'bracket' && <BracketTab d={d} onPlay={(m) => comingSoon(`Xem ${m.label.toLowerCase()}`)} />}
          {tab === 'schedule' && <ScheduleTab d={d} />}
          {tab === 'results' && <ResultsTab d={d} />}
        </ListStatus>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: TournamentStatus }) {
  const tone =
    status === 'open'
      ? 'bg-success-bg text-success ring-success/30'
      : status === 'live'
        ? 'bg-warning-bg text-warning ring-warning/30'
        : 'bg-surface-3 text-fg-muted ring-line-strong'
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ring-1', tone)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {TOURNAMENT_STATUS_LABEL[status]}
    </span>
  )
}

/* ---------------- Tab Thông tin ---------------- */

function InfoTab({ d, setTab, onContact }: { d: Detail; setTab: (t: DetailTab) => void; onContact: () => void }) {
  const progress = matchProgress(d)
  const schedule = scheduleOf(d)
  const upcoming = schedule.filter((m) => !m.score).slice(0, 2)
  const recent = schedule.filter((m) => m.score).reverse().slice(0, 2)
  const top = podium(d)

  const timeline: Array<{ title: string; detail: string; state: 'done' | 'current' | 'next' }> =
    d.status === 'open'
      ? [
          { title: 'Mở đăng ký', detail: `Hạn chót ${d.registrationDeadline}`, state: 'current' },
          { title: 'Bốc thăm nhánh đấu', detail: d.drawDate ?? 'Sau khi đóng đăng ký', state: 'next' },
          { title: 'Thi đấu', detail: d.dateRange, state: 'next' },
        ]
      : d.status === 'live'
        ? [
            { title: 'Đăng ký', detail: 'Đã đóng', state: 'done' },
            { title: 'Thi đấu', detail: `${d.dateRange} · đã xong ${progress.played}/${progress.total} trận`, state: 'current' },
            { title: 'Chung kết', detail: d.bracket[d.bracket.length - 1]?.matches[0]?.time ?? d.dateRange, state: 'next' },
          ]
        : [
            { title: 'Đăng ký', detail: 'Đã đóng', state: 'done' },
            { title: 'Thi đấu', detail: d.dateRange, state: 'done' },
            { title: 'Vô địch', detail: top ? top.champion.name : 'Đã trao giải', state: 'done' },
          ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card className="p-4 md:p-6">
          <SectionTitle icon={<Info size={20} />} title="Giới thiệu" />
          <p className="mt-3 max-w-[65ch] text-base text-fg/90">{d.description}</p>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <InfoLine label="Thể thức" value={d.formatLabel} />
            <InfoLine label="Hình thức" value={d.format} />
          </dl>
        </Card>

        <Card className="p-4 md:p-6">
          <SectionTitle icon={<CalendarClock size={20} />} title="Lộ trình giải" />
          <ol className="mt-4 flex flex-col gap-4">
            {timeline.map((s, i) => (
              <li key={s.title} className="relative flex gap-4">
                {i < timeline.length - 1 && (
                  <span aria-hidden className="absolute top-8 -bottom-4 left-4 w-px -translate-x-1/2 bg-line-strong" />
                )}
                <span
                  aria-hidden
                  className={cn(
                    'relative grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                    s.state === 'done' && 'bg-gold/20 text-gold',
                    s.state === 'current' && 'bg-gold text-gold-ink',
                    s.state === 'next' && 'bg-surface-3 text-fg-muted',
                  )}
                >
                  {s.state === 'done' ? <Check size={16} strokeWidth={3} /> : i + 1}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="text-base font-semibold">
                    {s.title}
                    {s.state === 'current' && <span className="ml-2 text-xs font-medium text-gold">Đang diễn ra</span>}
                  </p>
                  <p className="text-sm text-fg-muted">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-4 md:p-6">
          <SectionTitle icon={<ScrollText size={20} />} title="Luật thi đấu" />
          <ol className="mt-3 flex max-w-[65ch] list-decimal flex-col gap-2 pl-6 text-base text-fg/90 marker:text-fg-muted">
            {d.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </Card>

        <Card className="p-4 md:p-6">
          <SectionTitle icon={<Gift size={20} />} title="Giải thưởng" />
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {d.prizes.map((p, i) => (
              <li
                key={p.place}
                className={cn(
                  'flex flex-col gap-1 rounded-btn border p-4',
                  i === 0 ? 'border-gold/60 bg-gold-tint' : 'border-line bg-surface-2/60',
                )}
              >
                <span className={cn('flex items-center gap-2 text-sm font-semibold', i === 0 ? 'text-gold' : 'text-fg')}>
                  <Award size={16} aria-hidden />
                  {p.place}
                </span>
                <span className="text-sm text-fg/90">{p.reward}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <aside className="flex min-w-0 flex-col gap-6" aria-label="Tóm tắt giải đấu">
        <Card className="p-4">
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Kpi label="Đội" value={d.registeredTeams !== undefined ? `${d.registeredTeams}/${d.teamCount}` : String(d.teamCount)} />
            <Kpi label="Trận đã đấu" value={`${progress.played}/${progress.total}`} />
            <Kpi label="Hạng có thưởng" value={String(d.prizes.length)} />
          </dl>
        </Card>

        {top && (
          <Card className="border-gold/40 p-4">
            <p className="flex items-center gap-2 text-sm text-gold">
              <Trophy size={16} aria-hidden /> Vô địch
            </p>
            <p className="mt-2 flex items-center gap-3 text-lg font-bold">
              <TeamLogo team={top.champion} size={32} /> {top.champion.name}
            </p>
            <p className="mt-1 text-sm text-fg-muted">Á quân: {top.runnerUp.name}</p>
          </Card>
        )}

        <Card className="p-4">
          <SectionTitle
            size="sm"
            icon={<CalendarDays size={20} />}
            title="Trận sắp tới"
            action={<SeeAllLink onClick={() => setTab('schedule')}>Lịch thi đấu</SeeAllLink>}
          />
          <MatchList
            className="mt-3"
            matches={upcoming}
            empty={d.status === 'open' ? `Lịch công bố sau khi bốc thăm (${d.drawDate ?? 'sau hạn đăng ký'}).` : 'Không còn trận nào.'}
          />
        </Card>

        <Card className="p-4">
          <SectionTitle
            size="sm"
            icon={<Trophy size={20} />}
            title="Kết quả gần đây"
            action={<SeeAllLink onClick={() => setTab('results')}>Tất cả</SeeAllLink>}
          />
          <MatchList className="mt-3" matches={recent} empty="Chưa có trận nào kết thúc." />
        </Card>

        <Card className="p-4">
          <SectionTitle size="sm" icon={<Building2 size={20} />} title="Đơn vị tổ chức" />
          <p className="mt-3 text-base font-semibold">{d.organizer}</p>
          <p className="text-sm text-fg-muted">{d.category}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onContact}>
            Liên hệ ban tổ chức
          </Button>
        </Card>
      </aside>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-btn bg-surface-2/60 px-3 py-2">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="text-stat text-fg">{value}</dd>
    </div>
  )
}

/* ---------------- Tab Danh sách đội ---------------- */

const STANDING_TONE: Record<StandingTone, string> = {
  gold: 'bg-gold-tint text-gold ring-1 ring-gold/50',
  success: 'bg-success-bg text-success',
  neutral: 'bg-surface-3 text-fg-muted',
  muted: 'bg-surface-3 text-fg-subtle',
}

function TeamsTab({ d, onRegister }: { d: Detail; onRegister: () => void }) {
  const list = standings(d)
  const free = d.status === 'open' ? Math.max(0, d.teamCount - d.teamList.length) : 0
  return (
    <section aria-labelledby="teams-title">
      <h2 id="teams-title" className="text-lg font-semibold">
        {d.status === 'open' ? 'Các đội đã đăng ký' : 'Các đội tham gia'}{' '}
        <span className="text-base font-normal text-fg-muted tabular">
          ({d.teamList.length}/{d.teamCount})
        </span>
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s, i) => (
          <li key={s.team.id} className="flex min-w-0 items-center gap-3 rounded-card border border-line bg-surface/90 p-4">
            <span className="w-6 shrink-0 text-center text-sm text-fg-muted tabular">{i + 1}</span>
            <TeamLogo team={s.team} size={40} />
            <span className="min-w-0 flex-1 text-base font-semibold break-words">{s.team.name}</span>
            <span className={cn('shrink-0 rounded-full px-2 py-1 text-xs font-medium', STANDING_TONE[s.tone])}>{s.label}</span>
          </li>
        ))}
        {free > 0 && (
          <li className="flex min-w-0 flex-col items-start gap-3 rounded-card border border-dashed border-line-strong p-4">
            <p className="text-base font-semibold">Còn {free} chỗ trống</p>
            <p className="text-sm text-fg-muted">Hạn đăng ký {d.registrationDeadline}.</p>
            <Button variant="gold-outline" size="sm" rightIcon={<ArrowRight size={16} aria-hidden />} onClick={onRegister}>
              Đăng ký đội
            </Button>
          </li>
        )}
      </ul>
    </section>
  )
}

/* ---------------- Tab Bảng đấu ---------------- */

function BracketTab({ d, onPlay }: { d: Detail; onPlay: (m: BracketMatch) => void }) {
  if (d.bracket.length === 0) {
    return (
      <EmptyState
        className="min-h-80"
        icon={<LayoutGrid size={28} />}
        title="Nhánh đấu sẽ công bố sau khi đóng đăng ký"
        description={[d.drawDate && `Bốc thăm ${d.drawDate}`, `Thi đấu ${d.dateRange}`].filter(Boolean).join(' · ')}
      />
    )
  }
  return <Bracket rounds={d.bracket} formatLabel={d.formatLabel} onPlay={onPlay} />
}

/**
 * Nhánh loại trực tiếp dựng bằng flex (không toạ độ cứng). Cột sau tự căn giữa cặp trận cột trước;
 * đường nối là viền CSS. Rộng hơn khung → cuộn ngang trong vùng riêng, có bóng mờ ở mép còn nội dung.
 */
function Bracket({ rounds, formatLabel, onPlay }: { rounds: BracketRound[]; formatLabel: string; onPlay: (m: BracketMatch) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
  }, [])

  useEffect(() => {
    measure()
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const last = rounds.length - 1
  return (
    <Card className="p-4 md:p-6">
      <SectionTitle
        icon={<Trophy size={20} />}
        title="Nhánh đấu loại trực tiếp"
        action={<span className="text-sm text-fg-muted">{formatLabel}</span>}
      />
      {(edges.left || edges.right) && (
        <p className="mt-2 text-xs text-fg-muted">Vuốt hoặc cuộn ngang để xem hết nhánh đấu.</p>
      )}
      <div className="relative mt-4">
        <div
          ref={scrollRef}
          onScroll={measure}
          tabIndex={0}
          role="region"
          aria-label="Nhánh đấu (cuộn ngang)"
          className="relative overflow-x-auto pb-2 outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <div className="flex min-w-max gap-12">
            {rounds.map((round, r) => (
              <div key={round.name} className="flex w-60 flex-col">
                <h3 className="rounded-btn bg-surface-3/90 py-1 text-center text-sm font-medium">{round.name}</h3>
                <div className="mt-4 flex flex-1 flex-col">
                  {pairs(round.matches).map((pair, p) => (
                    <div key={p} className="relative flex flex-1 flex-col">
                      {pair.map((m) => (
                        <div key={m.id} className="flex flex-1 items-center py-2">
                          <MatchBox match={m} final={r === last} onPlay={onPlay} />
                        </div>
                      ))}
                      {r < last && pair.length === 2 && (
                        <>
                          <span aria-hidden className="absolute top-1/4 bottom-1/4 -right-6 w-6 rounded-r-btn border-y border-r border-gold/50" />
                          <span aria-hidden className="absolute top-1/2 -right-12 w-6 border-t border-gold/50" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Bóng mờ gợi ý cuộn — nằm ngoài vùng cuộn để không bị cuộn theo */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-12 bg-[linear-gradient(90deg,var(--color-surface),transparent)] transition-opacity',
            edges.left ? 'opacity-100' : 'opacity-0',
          )}
        />
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-12 bg-[linear-gradient(270deg,var(--color-surface),transparent)] transition-opacity',
            edges.right ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
    </Card>
  )
}

function pairs<T>(list: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2))
  return out
}

function MatchBox({ match, final, onPlay }: { match: BracketMatch; final?: boolean; onPlay: (m: BracketMatch) => void }) {
  const [a, b] = match.slots
  const decided = a.score !== null && b.score !== null
  const winner = decided ? (a.score! > b.score! ? 0 : 1) : -1
  const ready = isReadyMatch(match)
  return (
    <div
      className={cn(
        'w-full rounded-btn border p-3',
        final
          ? 'border-gold/90 bg-[linear-gradient(180deg,var(--color-gold-tint),var(--color-surface))] shadow-[0_0_24px_-4px_rgb(242_180_99/0.55)]'
          : 'border-line-strong/70 bg-surface-2/95',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-xs', final ? 'text-gold-200' : 'text-fg-muted')}>
          {match.label} · <span className="tabular">{match.time}</span>
        </p>
        {ready ? (
          <button
            type="button"
            onClick={() => onPlay(match)}
            aria-label={`Xem ${match.label}: ${a.team.name} gặp ${b.team.name}`}
            title="Xem trận"
            className="grid size-6 place-items-center rounded-full border border-gold/70 text-gold transition-colors hover:bg-gold hover:text-gold-ink"
          >
            <Play size={12} aria-hidden className="ml-px fill-current" />
          </button>
        ) : (
          <span aria-hidden className="size-6" />
        )}
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {match.slots.map((s, i) =>
          s.placeholder ? (
            // Slot API chưa có đội (API.md 9.3): BYE = đội kia đi tiếp; TBD = chờ thắng trận trước
            <li key={s.team.id} className="flex min-h-8 items-center gap-3" data-slot={s.placeholder}>
              <span aria-hidden className="size-6 shrink-0 rounded-full border border-dashed border-line-strong" />
              <span
                className={cn(
                  'min-w-0 flex-1 text-sm break-words',
                  s.placeholder === 'bye' ? 'font-semibold tracking-wide text-fg-subtle' : 'text-fg-muted italic',
                )}
              >
                {s.placeholder === 'bye' ? 'BYE' : 'Chưa xác định'}
              </span>
              <span className="grid h-6 min-w-8 place-items-center rounded-btn bg-surface-3 text-sm text-fg-subtle">–</span>
            </li>
          ) : (
          <li key={s.team.id} className="flex min-h-8 items-center gap-3">
            <TeamLogo team={s.team} size={24} />
            <span className={cn('min-w-0 flex-1 text-sm font-medium break-words', winner >= 0 && winner !== i && 'text-fg/70')}>
              {s.team.name}
            </span>
            <span
              className={cn(
                'grid h-6 min-w-8 place-items-center rounded-btn text-sm font-semibold tabular',
                winner === i ? 'bg-gold text-gold-ink' : 'bg-surface-4 text-fg/85',
              )}
            >
              {s.score ?? '–'}
            </span>
          </li>
          ),
        )}
      </ul>
    </div>
  )
}

/* ---------------- Tab Lịch thi đấu / Kết quả ---------------- */

function ScheduleTab({ d }: { d: Detail }) {
  const groups = groupByDate(DATA_SOURCE === 'api' ? d.upcoming : scheduleOf(d))
  if (groups.length === 0) {
    return (
      <EmptyState
        className="min-h-80"
        icon={<CalendarDays size={28} />}
        title="Chưa có lịch thi đấu"
        description={`Lịch sẽ công bố sau khi bốc thăm${d.drawDate ? ` (${d.drawDate})` : ''}. Thi đấu ${d.dateRange}.`}
      />
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g, i) => (
        <section key={g.date} aria-labelledby={`day-${i}`}>
          <h2 id={`day-${i}`} className="flex items-center gap-2 text-base font-semibold">
            <CalendarDays size={18} aria-hidden className="text-gold" />
            {isScheduled(g.date) ? `Ngày ${g.date}` : g.date}
            <span className="text-sm font-normal text-fg-muted">· {g.matches.length} trận</span>
          </h2>
          <MatchList className="mt-3" matches={g.matches} showClockOnly />
        </section>
      ))}
    </div>
  )
}

function ResultsTab({ d }: { d: Detail }) {
  const results = DATA_SOURCE === 'api'
    ? d.results
    : scheduleOf(d)
        .filter((m) => m.score)
        .reverse()
  const mockTop = DATA_SOURCE === 'mock' ? podium(d) : undefined
  const champion = DATA_SOURCE === 'api' ? d.champion : mockTop?.champion
  const championshipResult = champion ? results.find((match) => winnerOf(match)?.id === champion.id) : undefined
  const runnerUp = DATA_SOURCE === 'api'
    ? championshipResult && champion
      ? championshipResult.home.id === champion.id
        ? championshipResult.away
        : championshipResult.home
      : undefined
    : mockTop?.runnerUp
  if (results.length === 0) {
    return (
      <EmptyState
        className="min-h-80"
        icon={<ListOrdered size={28} />}
        title="Chưa có kết quả"
        description={`Giải thi đấu ${d.dateRange}. Kết quả sẽ cập nhật sau mỗi trận.`}
      />
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {champion && (
        <Card className="flex flex-col gap-4 border-gold/40 p-4 sm:flex-row sm:items-center md:p-6">
          <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-gold-tint text-gold">
            <Trophy size={28} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-gold">Nhà vô địch {d.name}</p>
            <p className="mt-1 flex items-center gap-3 text-2xl font-bold">
              <TeamLogo team={champion} size={32} />
              {champion.name}
            </p>
            {runnerUp && <p className="mt-1 text-sm text-fg-muted">Á quân: {runnerUp.name}</p>}
          </div>
        </Card>
      )}
      <section aria-labelledby="results-title">
        <h2 id="results-title" className="text-lg font-semibold">
          Kết quả các trận <span className="text-base font-normal text-fg-muted">(mới nhất trước)</span>
        </h2>
        <MatchList className="mt-3" matches={results} />
      </section>
    </div>
  )
}

/** Danh sách trận: tên đội xuống dòng thay vì cắt `…` */
function MatchList({
  matches,
  empty,
  className,
  showClockOnly,
}: {
  matches: ScheduledMatch[]
  empty?: string
  className?: string
  /** Trong nhóm theo ngày: chỉ hiện giờ */
  showClockOnly?: boolean
}) {
  if (matches.length === 0) {
    return <p className={cn('rounded-btn bg-surface-2/60 px-3 py-4 text-center text-sm text-fg-muted', className)}>{empty}</p>
  }
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {matches.map((m) => {
        const w = winnerOf(m)
        return (
          <li key={m.id} className="rounded-btn bg-surface-2/80 p-3">
            <p className="flex flex-wrap justify-between gap-x-3 text-xs text-fg-muted">
              <span>{m.stage}</span>
              {isScheduled(m.time) ? (
                <time className="tabular">{showClockOnly ? matchClock(m.time) : m.time}</time>
              ) : (
                <span className="text-warning">{m.time}</span>
              )}
            </p>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <span className={cn('flex min-w-0 items-center justify-end gap-2 text-right text-sm', w && w.id !== m.home.id && 'text-fg/70')}>
                <span className="min-w-0 break-words">{m.home.name}</span>
                <TeamLogo team={m.home} size={24} />
              </span>
              {m.score ? (
                <p className="text-center text-lg font-bold tabular" aria-label={`Tỉ số ${m.score[0]} - ${m.score[1]}`}>
                  <span className={w?.id === m.home.id ? 'text-gold' : 'text-fg/85'}>{m.score[0]}</span>
                  <span className="mx-1 text-fg-muted">–</span>
                  <span className={w?.id === m.away.id ? 'text-gold' : 'text-fg/85'}>{m.score[1]}</span>
                </p>
              ) : (
                <p className="text-center text-sm font-bold text-gold">VS</p>
              )}
              <span className={cn('flex min-w-0 items-center gap-2 text-sm', w && w.id !== m.away.id && 'text-fg/70')}>
                <TeamLogo team={m.away} size={24} />
                <span className="min-w-0 break-words">{m.away.name}</span>
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function TeamLogo({ team, size }: { team: Team; size: number }) {
  return (
    <img
      src={team.logo}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="shrink-0 object-contain mix-blend-lighten"
      style={{ width: size, height: size }}
    />
  )
}
