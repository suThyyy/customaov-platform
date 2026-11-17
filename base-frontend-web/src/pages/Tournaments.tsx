import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpDown,
  Award,
  CalendarDays,
  Check,
  ChevronDown,
  Flag,
  Gamepad2,
  Network,
  Plus,
  Radio,
  Search,
  SearchX,
  Trophy,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { normalizeVi } from '../lib/text'
import { ListStatus, SkeletonCards } from '../components/ui/ListStatus'
import { useAuth } from '../context/AppContext'
import { tournamentsAdapter, useTournaments, type StageStatus, type Tournament, type TournamentStatus } from '../api'
import { Button, ButtonLink } from '../components/ui/Button'
import { Badge } from '../components/ui/primitives'
import { FilterChips } from '../components/ui/FilterChips'
import { Pagination } from '../components/ui/Pagination'
import { PageHeader } from '../components/layout/PageHeader'
import { loginHref } from '../components/layout/nav'
import { EmptyState } from '../components/domain/EmptyState'
import { RegistrationProgress } from '../components/domain/RegistrationProgress'
import { SampleDataBadge } from '../components/ui/SampleDataBadge'

type Filter = 'all' | TournamentStatus
type Sort = 'newest' | 'oldest'

/** 3 cột × 2 hàng ở desktop */
const PAGE_SIZE = 6

const FILTER_LABELS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'open', label: 'Đang mở đăng ký' },
  { id: 'live', label: 'Đang diễn ra' },
  { id: 'finished', label: 'Đã kết thúc' },
]

const TITLE_ICON: Record<Tournament['titleIcon'], LucideIcon> = {
  laurel: Award,
  trophy: Trophy,
  flag: Flag,
}

const isFilter = (v: string | null): v is Filter => FILTER_LABELS.some((f) => f.id === v)

export default function Tournaments() {
  const { loggedIn } = useAuth()
  const load = useTournaments()
  const tournaments = load.data

  // Bộ lọc lưu trên URL (?q=&status=&sort=&page=) để chia sẻ link / quay lại không mất trạng thái
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const rawStatus = params.get('status')
  const filter: Filter = isFilter(rawStatus) ? rawStatus : 'all'
  const sort: Sort = params.get('sort') === 'oldest' ? 'oldest' : 'newest'
  const pageParam = Number(params.get('page') ?? '1')

  const update = (patch: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    // Đổi bộ lọc thì quay về trang 1
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace })
  }

  const searched = useMemo(() => {
    const q = normalizeVi(query.trim())
    if (!q) return tournaments
    return tournaments.filter((t) => [t.name, t.organizer, t.format].some((f) => normalizeVi(f).includes(q)))
  }, [query, tournaments])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: searched.length, open: 0, live: 0, finished: 0 }
    for (const t of searched) c[t.status]++
    return c
  }, [searched])

  const list = useMemo(() => {
    const filtered = filter === 'all' ? searched : searched.filter((t) => t.status === filter)
    return [...filtered].sort((a, b) =>
      sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
    )
  }, [searched, filter, sort])

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const page = Number.isInteger(pageParam) ? Math.min(Math.max(1, pageParam), totalPages) : 1
  const pageItems = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasCriteria = query.trim() !== '' || filter !== 'all'

  const resetAll = () => setParams(sort === 'newest' ? {} : { sort })

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Giải đấu cộng đồng"
        description="Tham gia các giải đấu custom do cộng đồng tổ chức, tranh tài cùng những đội tuyển trên khắp Liên Quân."
        actions={
          <span className="flex flex-wrap items-center gap-3">
            <SampleDataBadge show={tournamentsAdapter.showsSampleBadge} />
            <ButtonLink to={loggedIn ? '/tournaments/new' : loginHref('login', '/tournaments/new')} leftIcon={<Plus size={18} aria-hidden />}>
              Tạo giải đấu
            </ButtonLink>
          </span>
        }
      />

      {/* Thanh công cụ: tìm kiếm + sắp xếp, hàng dưới là bộ lọc trạng thái */}
      <div role="search" className="mt-6 flex flex-col gap-3" aria-label="Tìm và lọc giải đấu">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex h-11 w-full min-w-0 items-center sm:flex-1 rounded-btn border border-line-strong bg-surface/80 transition-colors focus-within:border-gold/60 hover:border-white/30">
            <Search size={18} aria-hidden className="pointer-events-none absolute left-4 text-fg-muted" />
            <span className="sr-only">Tìm giải đấu</span>
            <input
              type="search"
              value={query}
              onChange={(e) => update({ q: e.target.value }, true)}
              placeholder="Tìm theo tên giải, đơn vị tổ chức…"
              className="h-full w-full min-w-0 bg-transparent pr-12 pl-12 text-base text-fg outline-none placeholder:text-fg-subtle [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => update({ q: null }, true)}
                aria-label="Xoá từ khoá"
                className="absolute right-2 grid size-8 place-items-center rounded-btn text-fg-muted hover:bg-white/5 hover:text-fg"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </label>
          <label className="relative flex h-11 w-full shrink-0 items-center rounded-btn border border-line-strong bg-surface/80 transition-colors focus-within:border-gold/60 hover:border-white/30 sm:w-56">
            <ArrowUpDown size={18} aria-hidden className="pointer-events-none absolute left-4 text-fg-muted" />
            <span className="sr-only">Sắp xếp</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })}
              className="h-full w-full appearance-none bg-transparent pr-10 pl-12 text-base text-fg outline-none"
            >
              <option value="newest" className="bg-surface-2">
                Mới nhất
              </option>
              <option value="oldest" className="bg-surface-2">
                Cũ nhất
              </option>
            </select>
            <ChevronDown size={18} aria-hidden className="pointer-events-none absolute right-4 text-fg-muted" />
          </label>
        </div>
        <FilterChips
          label="Lọc theo trạng thái"
          options={FILTER_LABELS.map((f) => ({ ...f, count: counts[f.id] }))}
          value={filter}
          onChange={(id) => update({ status: id === 'all' ? null : id })}
        />
      </div>

      {/* Danh sách: loading (skeleton) / lỗi (Thử lại) / rỗng (EmptyState) / dữ liệu — xem lib/mockStatus.ts */}
      <ListStatus
        status={load.status}
        onRetry={load.retry}
        label="danh sách giải đấu"
        className="mt-4"
        skeleton={<SkeletonCards count={PAGE_SIZE} className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />}
      >
        <p className="mt-4 text-sm text-fg-muted" aria-live="polite">
          {list.length === 0 ? 'Không tìm thấy giải đấu nào' : `Hiển thị ${pageItems.length} / ${list.length} giải đấu`}
        </p>

        {list.length === 0 ? (
          <EmptyState
            className="mt-4 py-12"
            icon={hasCriteria ? <SearchX size={28} /> : <Trophy size={28} />}
            title={hasCriteria ? 'Không có giải đấu phù hợp' : 'Chưa có giải đấu nào'}
            description={
              query.trim()
                ? `Không tìm thấy giải nào khớp với “${query.trim()}”${filter !== 'all' ? ` ở mục “${FILTER_LABELS.find((f) => f.id === filter)?.label}”` : ''}. Thử từ khoá khác hoặc xoá bộ lọc.`
                : 'Không có giải đấu nào ở trạng thái này. Thử chọn trạng thái khác.'
            }
            action={
              hasCriteria && (
                <Button variant="outline" onClick={resetAll}>
                  Xoá bộ lọc
                </Button>
              )
            }
          />
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((t) => (
              <TournamentCard key={t.slug} t={t} />
            ))}
          </ul>
        )}

        <Pagination
          className="mt-8"
          label="Phân trang danh sách giải"
          page={page}
          totalPages={totalPages}
          onChange={(p) => update({ page: p === 1 ? null : String(p) })}
        />
      </ListStatus>
    </div>
  )
}

function StatusOverlay({ status }: { status: TournamentStatus }) {
  const cls = 'inline-flex h-8 items-center gap-2 rounded-btn px-3 text-xs font-semibold shadow-[var(--shadow-card)]'
  if (status === 'open')
    return (
      <span className={cn(cls, 'bg-open text-open-ink')}>
        <UsersRound size={15} aria-hidden /> Đang mở đăng ký
      </span>
    )
  if (status === 'live')
    return (
      <span className={cn(cls, 'bg-gold-gradient text-gold-ink')}>
        <Radio size={15} aria-hidden /> Đang diễn ra
      </span>
    )
  return (
    <span className={cn(cls, 'bg-finished/95 text-fg')}>
      <Check size={15} aria-hidden /> Đã kết thúc
    </span>
  )
}

function StageChip({ status }: { status: StageStatus }) {
  if (status === 'live') return <Badge tone="success">Đang diễn ra</Badge>
  return <Badge tone="neutral">{status === 'finished' ? 'Đã kết thúc' : 'Chưa bắt đầu'}</Badge>
}

/** Card giải dạng dọc: ảnh trên, thông tin dưới. Nút "Xem chi tiết" luôn nằm ở đáy card. */
function TournamentCard({ t }: { t: Tournament }) {
  const TitleIcon = TITLE_ICON[t.titleIcon]
  return (
    <li className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-line-strong/70 bg-surface/90 transition-[border-color] duration-200 hover:border-gold/35">
      {/* Ảnh mock có badge in sẵn ở góc trái trên → khung 16:9 + object-right để cắt bỏ phần đó */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={t.cover}
          alt=""
          className="size-full object-cover object-right transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-12 bg-[linear-gradient(0deg,var(--color-surface),transparent)]" />
        <span className="absolute top-3 left-3">
          <StatusOverlay status={t.status} />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
        <div className="min-w-0">
          <h2 className="flex items-start gap-2 font-display text-lg font-bold text-fg">
            <span className="min-w-0">{t.name}</span>
            <TitleIcon size={20} aria-hidden className="mt-1 shrink-0 text-gold" />
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
            <span className="flex items-center gap-2">
              <Gamepad2 size={16} aria-hidden />
              {t.format}
            </span>
            <span className="flex items-center gap-2">
              <UsersRound size={16} aria-hidden className="text-gold" />
              {t.organizer}
            </span>
          </p>
          <p className="mt-3 line-clamp-2 text-sm text-fg-muted" title={t.description}>
            {t.description}
          </p>
        </div>

        <dl className="mt-auto flex flex-col gap-2 border-t border-line pt-4 text-sm">
          {t.registeredTeams !== undefined ? (
            <div>
              <dt className="sr-only">Tiến độ đăng ký</dt>
              <dd>
                <RegistrationProgress registered={t.registeredTeams} total={t.teamCount} />
              </dd>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Số đội</dt>
              <UsersRound size={16} aria-hidden className="text-fg-muted" />
              <dd>{t.teamCount} đội</dd>
            </div>
          )}
          <div className="flex items-center gap-2">
            <dt className="sr-only">Thời gian</dt>
            <CalendarDays size={16} aria-hidden className="shrink-0 text-fg-muted" />
            <dd>{t.timeLabel}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Network size={16} aria-hidden className="shrink-0 text-fg-muted" />
            <dt>Vòng bảng:</dt>
            <dd>
              <StageChip status={t.groupStage} />
            </dd>
          </div>
        </dl>

        <ButtonLink
          to={`/tournaments/${t.slug}`}
          variant="gold-outline"
          className="w-full"
          rightIcon={<ArrowRight size={16} aria-hidden />}
          aria-label={`Xem chi tiết ${t.name}`}
        >
          Xem chi tiết
        </ButtonLink>
      </div>
    </li>
  )
}
