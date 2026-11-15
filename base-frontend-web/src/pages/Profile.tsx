import { useCallback, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Award,
  BarChart3,
  CircleHelp,
  Clock3,
  Copy,
  Crosshair,
  Crown,
  Feather,
  Gamepad2,
  History,
  LayoutDashboard,
  MoreHorizontal,
  PawPrint,
  PenLine,
  ShieldPlus,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  UserRound,
  UsersRound,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { asset } from '../lib/asset'
import { cn } from '../lib/cn'
import { useToast } from '../context/AppContext'
import { ListStatus, SkeletonRows } from '../components/ui/ListStatus'
import { DATA_SOURCE, currentUser, useProfile, type Achievement, type HookResult, type MatchHistoryItem, type ProfileRecordHistoryItem, type RoleStat, type UserProfile } from '../api'
import { Button, ButtonLink, IconButton } from '../components/ui/Button'
import { Avatar, Badge, Card, LevelPill, SectionTitle, SeeAllLink } from '../components/ui/primitives'
import { Tabs } from '../components/ui/Tabs'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/domain/EmptyState'
import { EditProfileDialog } from '../components/domain/EditProfileDialog'

type ProfileTab = 'overview' | 'history' | 'champions' | 'achievements'

const TAB_ITEMS: Array<{ id: ProfileTab; label: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Tổng quan', icon: <LayoutDashboard size={18} /> },
  { id: 'history', label: 'Lịch sử trận', icon: <History size={18} /> },
  { id: 'champions', label: 'Tướng ưa thích', icon: <Star size={18} /> },
  { id: 'achievements', label: 'Thành tích', icon: <Trophy size={18} /> },
]

const isTab = (v: string | null): v is ProfileTab => TAB_ITEMS.some((t) => t.id === v)

const ROLE_ICON: Record<RoleStat['icon'], LucideIcon> = {
  ad: Crosshair,
  mage: WandSparkles,
  jungle: PawPrint,
  mid: Feather,
  tank: ShieldPlus,
}

const ACHIEVEMENT_ICON: Record<Achievement['icon'], LucideIcon> = {
  trophy: Trophy,
  star: Star,
  swords: Swords,
  users: UsersRound,
}

/** Ảnh bìa mỏng: chỉ trang trí, không đặt chữ lên ảnh; gradient tối từ dưới lên để nối vào nền */
function Cover() {
  return (
    <div className="relative mt-6 h-32 overflow-hidden rounded-card border border-line md:h-44">
      <img src={asset('hero-profile.jpg')} alt="" className="size-full object-cover object-[50%_35%]" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,var(--color-bg)_0%,rgb(13_15_19/0.55)_40%,transparent_100%)]" />
    </div>
  )
}

export default function Profile() {
  const { userId } = useParams()
  const load = useProfile(userId)
  if (load.status !== 'ready') {
    return (
      <ListStatus status={load.status} onRetry={load.retry} label="hồ sơ" className="mt-6" skeleton={<SkeletonRows count={6} />}>
        {null}
      </ListStatus>
    )
  }
  // Giữ nguyên màn hồ sơ công khai giả lập; nguồn API có đầy đủ số liệu hồ sơ người khác.
  if (DATA_SOURCE === 'mock' && userId && userId !== currentUser.id) return <OtherProfile userId={userId} profile={load.data} />
  if (!load.data) return <ProfileNotFound userId={userId} />
  return <MyProfile profile={load.data} load={load} isOwn={!userId || userId === currentUser.id} />
}

function ProfileNotFound({ userId }: { userId?: string }) {
  return (
    <EmptyState
      className="mt-6 min-h-96"
      icon={<UserRound size={28} />}
      as="h1"
      title="Không tìm thấy người chơi"
      description={userId ? `Không có người chơi "${userId}".` : 'Không tìm thấy hồ sơ của bạn.'}
      action={<ButtonLink to="/profile" variant="outline">Về hồ sơ của tôi</ButtonLink>}
    />
  )
}

function OtherProfile({ userId, profile }: { userId: string; profile: UserProfile | undefined }) {
  const player = profile?.player
  if (!player) {
    return (
      <EmptyState
        className="mt-6 min-h-96"
        icon={<UserRound size={28} />}
        as="h1"
        title="Không tìm thấy người chơi"
        description={`Không có người chơi "${userId}".`}
        action={
          <ButtonLink to="/profile" variant="outline">
            Về hồ sơ của tôi
          </ButtonLink>
        }
      />
    )
  }
  return (
    <div className="flex flex-col">
      <Cover />
      <PageHeader
        flush
        className="px-2 md:px-6"
        leading={
          <Avatar
            src={player.avatar}
            name={player.name}
            alt={`Ảnh đại diện ${player.name}`}
            size={96}
            rounded="xl"
            className="relative -mt-10 size-16! ring-4 ring-bg md:-mt-14 md:size-24!"
          />
        }
        title={player.name}
        meta={<p className="text-sm text-fg-muted">@{player.id}</p>}
      />
      <EmptyState
        className="mt-6 min-h-60"
        icon={<BarChart3 size={28} />}
        title="Hồ sơ công khai đang phát triển"
        description={`Thống kê và lịch sử trận của ${player.name} sẽ hiển thị khi có dữ liệu từ máy chủ.`}
      />
    </div>
  )
}

function MyProfile({ profile: p, load, isOwn }: { profile: UserProfile; load: HookResult<UserProfile | undefined>; isOwn: boolean }) {
  const { comingSoon, notify } = useToast()
  const [editing, setEditing] = useState(false)
  const closeEditor = useCallback(() => setEditing(false), [])
  const openEditor = useCallback(() => setEditing(true), [])
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab')
  const tab: ProfileTab = isTab(rawTab) ? rawTab : 'overview'
  const setTab = (t: ProfileTab) => setParams(t === 'overview' ? {} : { tab: t })

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(p.publicId)
      notify('Đã sao chép ID', p.publicId)
    } catch {
      notify('Không thể sao chép', 'Trình duyệt chặn clipboard.')
    }
  }

  return (
    <div className="flex flex-col">
      <Cover />
      <PageHeader
        flush
        className="px-2 md:px-6"
        leading={
          // Avatar đè lên mép dưới ảnh bìa
          <Avatar
            src={p.player.avatar}
            name={p.player.name}
            alt={`Ảnh đại diện ${p.player.name}`}
            size={96}
            rounded="xl"
            className="relative -mt-10 size-16! ring-4 ring-bg md:-mt-14 md:size-24!"
          />
        }
        title={
          <span className="flex items-center gap-3">
            {p.player.name}
            <Crown size={24} aria-label="Chủ phòng" className="fill-gold text-gold" />
          </span>
        }
        meta={
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg/90">
              <LevelPill level={p.player.level ?? 1} className="px-2 text-sm leading-6" />
              <span aria-hidden className="h-4 w-px bg-line-strong" />
              <span className="flex items-center gap-1">
                {p.publicId}
                <IconButton label="Sao chép ID người dùng" variant="ghost" className="size-8" onClick={copyId}>
                  <Copy size={14} aria-hidden />
                </IconButton>
              </span>
              <span aria-hidden className="h-4 w-px bg-line-strong" />
              <span className="text-fg-muted">
                UID <span className="tabular">{p.uid}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="gold-outline" className="py-1 text-sm font-semibold" icon={<Crown size={14} aria-hidden className="fill-current" />}>
                {p.roleBadge}
              </Badge>
              <Badge tone="neutral" className="py-1 text-sm text-fg ring-1 ring-line-strong" icon={<Gamepad2 size={16} aria-hidden />}>
                {p.playerBadge}
              </Badge>
            </div>
            {/* Dòng trạng thái: xuống dòng tự nhiên, không cắt */}
            <p className="max-w-[65ch] text-sm text-fg/90">
              <Sparkles size={14} aria-hidden className="mr-2 inline text-gold" />
              {p.bio} <span className="text-fg-muted">·</span> {p.bioExtra}
            </p>
          </div>
        }
        actions={
          <>
            {isOwn && (
              <Button variant="outline" leftIcon={<PenLine size={16} aria-hidden />} onClick={openEditor}>
                Chỉnh sửa hồ sơ
              </Button>
            )}
            <IconButton label="Tùy chọn hồ sơ" className="size-10" onClick={() => comingSoon('Tùy chọn hồ sơ')}>
              <MoreHorizontal size={20} aria-hidden />
            </IconButton>
          </>
        }
        tabs={
          <Tabs<ProfileTab>
            label="Nội dung hồ sơ"
            idPrefix="profile"
            value={tab}
            onChange={setTab}
            items={TAB_ITEMS}
            className="h-12 gap-1"
            itemClassName="rounded-t-btn px-4 text-base aria-selected:bg-white/[0.06] [&>span:first-child]:text-current"
          />
        }
      />

      <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${tab}`} className="mt-6">
        <ListStatus
          status={load.status}
          onRetry={load.retry}
          label={`nội dung "${TAB_ITEMS.find((t) => t.id === tab)?.label}"`}
          skeleton={<SkeletonRows count={4} />}
        >
          {tab === 'overview' && <Overview profile={p} setTab={setTab} onMatchMore={(id) => comingSoon(`Chi tiết trận ${id}`)} />}
          {tab === 'history' && (
            <Card className="p-4">
              <SectionTitle
                size="sm"
                icon={<Clock3 size={20} />}
                title={`Lịch sử trận (${p.recordHistory?.length ?? p.history.length} trận gần nhất)`}
              />
              {p.recordHistory ? (
                <RecordHistoryList className="mt-3" items={p.recordHistory} />
              ) : (
                <HistoryList className="mt-3" items={p.history} onMore={(id) => comingSoon(`Chi tiết trận ${id}`)} />
              )}
            </Card>
          )}
          {tab === 'champions' && <ChampionsTab profile={p} />}
          {tab === 'achievements' && <AchievementsTab profile={p} />}
        </ListStatus>
      </div>
      {isOwn && <EditProfileDialog open={editing} onClose={closeEditor} profile={p} onSaved={load.retry} />}
    </div>
  )
}

/* ---------------- Tổng quan: chỉ tóm tắt ---------------- */

function Overview({ profile: p, setTab, onMatchMore }: { profile: UserProfile; setTab: (t: ProfileTab) => void; onMatchMore: (id: string) => void }) {
  const stats: Array<{ icon: LucideIcon; label: string; value: string }> = p.hasGameData === false
    ? [
        { icon: Gamepad2, label: 'Trận Custom', value: String(p.stats.customMatches) },
        { icon: Trophy, label: 'Thắng', value: String(p.stats.wins ?? 0) },
        { icon: Swords, label: 'Thua', value: String(p.stats.losses ?? 0) },
        { icon: BarChart3, label: 'Tỷ lệ thắng', value: `${p.stats.winRate}%` },
        { icon: UsersRound, label: 'Giải đã tham gia', value: String(p.stats.tournamentsJoined ?? 0) },
        { icon: Crown, label: 'Danh hiệu', value: String(p.stats.titles ?? 0) },
      ]
    : [
        { icon: Swords, label: 'Tổng trận', value: String(p.stats.totalMatches) },
        { icon: BarChart3, label: 'Tỷ lệ thắng', value: `${p.stats.winRate}%` },
        { icon: Gamepad2, label: 'Trận Custom', value: String(p.stats.customMatches) },
        { icon: Trophy, label: 'MVP', value: String(p.stats.mvp) },
      ]
  const topChampions = p.champions.slice(0, 3)
  const topRoles = p.roles.slice(0, 3)

  return (
    <div className="flex flex-col gap-6">
      <dl className={cn('grid grid-cols-2 gap-3 lg:gap-6', p.hasGameData === false ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="flex min-h-20 items-center gap-4 px-4 py-3 lg:gap-6 lg:px-6">
            {/* < 640px: ẩn icon để số KPI (text-stat 32px) không tràn ô ~160px */}
            <Icon size={36} aria-hidden strokeWidth={1.7} className="hidden shrink-0 text-gold sm:block" />
            <div className="min-w-0">
              <dt className="text-base text-fg/90">{label}</dt>
              <dd className="text-stat">{value}</dd>
            </div>
          </Card>
        ))}
      </dl>

      {p.hasGameData === false ? (
        <GameDataEmpty />
      ) : <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle
            size="sm"
            icon={<Star size={20} />}
            title="Tướng ưa thích"
            action={<SeeAllLink onClick={() => setTab('champions')}>Tất cả {p.champions.length} tướng</SeeAllLink>}
          />
          <ul className="mt-3 flex flex-col">
            {topChampions.map((c, i) => (
              <li key={c.name} className={cn('flex items-center gap-3 py-2', i > 0 && 'border-t border-line')}>
                <Avatar src={c.avatar ?? c.image} name={c.name} alt="" size={40} rounded="lg" />
                <span className="min-w-0 flex-1 text-base font-semibold">{c.name}</span>
                <span className="text-sm text-fg-muted tabular">{c.matches} trận</span>
                <span className="w-12 text-right text-base font-bold text-gold tabular">
                  {c.winRate}%<span className="sr-only"> tỷ lệ thắng</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <SectionTitle
            size="sm"
            icon={<Target size={20} />}
            title={
              <span className="flex items-center gap-2">
                Vai trò chính
                <CircleHelp size={16} aria-label="Tỷ lệ vai trò trong các trận gần đây" className="text-fg-muted" />
              </span>
            }
            action={<SeeAllLink onClick={() => setTab('champions')}>Chi tiết</SeeAllLink>}
          />
          <RoleBars roles={topRoles} className="mt-4" />
        </Card>
      </div>}

      <Card className="p-4">
        <SectionTitle
          size="sm"
          icon={<Clock3 size={20} />}
          title="Trận gần đây"
          action={<SeeAllLink onClick={() => setTab('history')}>Xem lịch sử</SeeAllLink>}
        />
        {p.recordHistory ? (
          <RecordHistoryList className="mt-3" items={p.recordHistory.slice(0, 3)} />
        ) : (
          <HistoryList className="mt-3" items={p.history.slice(0, 3)} onMore={onMatchMore} />
        )}
      </Card>
    </div>
  )
}

function RoleBars({ roles, className }: { roles: RoleStat[]; className?: string }) {
  const max = Math.max(...roles.map((r) => r.percent), 1)
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {roles.map((r) => {
        const Icon = ROLE_ICON[r.icon]
        return (
          <li key={r.role} className="grid grid-cols-[20px_minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
            <Icon size={18} aria-hidden className="text-fg/85" />
            <span>{r.role}</span>
            <span
              role="meter"
              aria-label={r.role}
              aria-valuenow={r.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-surface-4"
            >
              <span className="block h-full rounded-full bg-gold" style={{ width: `${Math.max((r.percent / max) * 100, 4)}%` }} />
            </span>
            <span className="text-right tabular">{r.percent}%</span>
          </li>
        )
      })}
    </ul>
  )
}

function GameDataEmpty() {
  return (
    <EmptyState
      className="min-h-60"
      icon={<Gamepad2 size={28} />}
      title="Chưa có dữ liệu từ game – sẽ có sau MVP"
      description="Tướng ưa thích, KDA, vai trò và trang bị chưa được hệ thống ghi nhận."
    />
  )
}

function RecordHistoryList({ items, className }: { items: ProfileRecordHistoryItem[]; className?: string }) {
  if (items.length === 0) {
    return (
      <EmptyState
        className={cn('min-h-60', className)}
        icon={<History size={28} />}
        title="Chưa có lịch sử trận"
        description="Vào một phòng custom để bắt đầu ghi lịch sử."
      />
    )
  }
  return (
    <ul className={cn('flex flex-col', className)}>
      {items.map((item, index) => (
        <li key={item.id} className={cn('flex flex-wrap items-center gap-3 py-3', index > 0 && 'border-t border-line')}>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{item.roomName}</p>
            <p className="text-xs text-fg-muted">{item.roomCode}</p>
          </div>
          <ResultBadge result={item.result} />
          <span className="whitespace-nowrap text-sm text-fg-muted">{item.timeAgo}</span>
        </li>
      ))}
    </ul>
  )
}

/* ---------------- Lịch sử trận ---------------- */

/**
 * ≥ 768: bảng (cột "Trang bị" chỉ hiện từ 1024). < 768: card list.
 * Cột "Thời gian" không xuống dòng (trước đây bị ép thành "18 / phút / trước").
 */
function HistoryList({ items, onMore, className }: { items: MatchHistoryItem[]; onMore: (id: string) => void; className?: string }) {
  const cell = (i: number) => cn('py-3 pr-4 align-middle', i > 0 && 'border-t border-line')
  if (items.length === 0) {
    return (
      <p className={cn('rounded-btn bg-surface-2/60 px-3 py-6 text-center text-sm text-fg-muted', className)}>
        Chưa có trận nào. Vào một phòng custom để bắt đầu ghi lịch sử.
      </p>
    )
  }
  return (
    <div className={className}>
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Lịch sử trận</caption>
          <thead>
            <tr className="bg-surface-3/70 text-left text-sm text-fg/85">
              <th scope="col" className="rounded-l-btn py-2 pr-4 pl-3 font-normal">
                Trận
              </th>
              <th scope="col" className="py-2 pr-4 font-normal">
                Tướng
              </th>
              <th scope="col" className="py-2 pr-4 font-normal">
                Kết quả
              </th>
              <th scope="col" className="py-2 pr-4 font-normal">
                KDA
              </th>
              <th scope="col" className="hidden py-2 pr-4 font-normal lg:table-cell">
                Trang bị
              </th>
              <th scope="col" className="py-2 pr-4 font-normal whitespace-nowrap">
                Thời gian
              </th>
              <th scope="col" className="w-12 rounded-r-btn">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((h, i) => (
              <tr key={h.id} className="transition-colors hover:bg-white/[0.025]">
                <td className={cn(cell(i), 'pl-3')}>
                  <p className="font-semibold">{h.mode}</p>
                  <p className="text-xs text-fg-muted">{h.roomName}</p>
                </td>
                <td className={cell(i)}>
                  <span className="flex items-center gap-3 whitespace-nowrap">
                    <Avatar src={h.champion.avatar} name={h.champion.name} alt="" size={36} className="ring-2 ring-white/10" />
                    <span className="font-medium">{h.champion.name}</span>
                  </span>
                </td>
                <td className={cell(i)}>
                  <ResultBadge result={h.result} />
                </td>
                <td className={cn(cell(i), 'whitespace-nowrap')}>
                  <p className="font-semibold tabular">{h.kda.join(' / ')}</p>
                  <p className="text-xs text-fg-muted tabular">KDA {h.kdaRatio.toFixed(1)}</p>
                </td>
                <td className={cn(cell(i), 'hidden lg:table-cell')}>
                  <ItemIcons items={h.items} />
                </td>
                <td className={cn(cell(i), 'whitespace-nowrap text-fg/85')}>{h.timeAgo}</td>
                <td className={cn(cell(i), 'pr-2 text-right')}>
                  <IconButton label={`Chi tiết trận ${h.id}`} variant="secondary" className="size-8" onClick={() => onMore(h.id)}>
                    <MoreHorizontal size={18} aria-hidden />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((h) => (
          <li key={h.id} className="rounded-btn border border-line bg-surface-2/60 p-3">
            <div className="flex items-start gap-3">
              <Avatar src={h.champion.avatar} name={h.champion.name} alt="" size={40} className="ring-2 ring-white/10" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {h.champion.name}
                  <ResultBadge result={h.result} />
                </p>
                <p className="text-xs text-fg-muted">
                  {h.mode} · {h.roomName}
                </p>
              </div>
              <IconButton label={`Chi tiết trận ${h.id}`} variant="secondary" className="size-8 shrink-0" onClick={() => onMore(h.id)}>
                <MoreHorizontal size={18} aria-hidden />
              </IconButton>
            </div>
            <p className="mt-2 flex flex-wrap justify-between gap-x-4 text-sm">
              <span className="tabular">
                <span className="font-semibold">{h.kda.join(' / ')}</span>{' '}
                <span className="text-xs text-fg-muted">KDA {h.kdaRatio.toFixed(1)}</span>
              </span>
              <span className="whitespace-nowrap text-fg-muted">{h.timeAgo}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResultBadge({ result }: { result: MatchHistoryItem['result'] }) {
  return result === 'win' ? (
    <Badge tone="success" className="min-w-16 justify-center py-1 text-sm font-semibold">
      Thắng
    </Badge>
  ) : (
    <Badge tone="danger" className="min-w-16 justify-center py-1 text-sm font-semibold">
      Thua
    </Badge>
  )
}

function ItemIcons({ items }: { items: string[] }) {
  return (
    <ul className="flex gap-2" aria-label="Trang bị">
      {items.map((src, k) => (
        <li key={k}>
          <img src={src} alt={`Trang bị ${k + 1}`} className="size-8 rounded-btn object-cover ring-1 ring-white/15" />
        </li>
      ))}
    </ul>
  )
}

/* ---------------- Tướng ưa thích ---------------- */

function ChampionsTab({ profile: p }: { profile: UserProfile }) {
  if (p.hasGameData === false) return <GameDataEmpty />
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4">
        <SectionTitle size="sm" icon={<Star size={20} />} title="Tướng ưa thích" />
        <p className="mt-1 text-sm text-fg-muted">Dựa trên các trận custom đã chơi.</p>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
          {p.champions.map((c) => (
            <li
              key={c.name}
              className="group overflow-hidden rounded-btn border border-line-strong/80 bg-surface-2/90 text-center transition-[border-color] hover:border-gold/45"
            >
              <div className="aspect-video overflow-hidden">
                <img src={c.image} alt={c.name} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <p className="mt-2 text-base font-bold">{c.name}</p>
              <p className="mt-1 flex items-center justify-center gap-2 text-sm text-fg/85">
                <Gamepad2 size={14} aria-hidden className="text-fg-muted" />
                {c.matches} trận
              </p>
              <p className="mt-1 mb-3 flex items-center justify-center gap-2 text-base font-bold text-gold tabular">
                <Trophy size={16} aria-hidden />
                {c.winRate}%<span className="sr-only"> tỷ lệ thắng</span>
              </p>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-4">
        <SectionTitle size="sm" icon={<Target size={20} />} title="Vai trò" />
        <RoleBars roles={p.roles} className="mt-4 max-w-2xl" />
      </Card>
    </div>
  )
}

/* ---------------- Thành tích ---------------- */

function AchievementsTab({ profile }: { profile: UserProfile }) {
  const list = profile.achievements
  if (list.length === 0) {
    return <EmptyState className="min-h-60" icon={<Award size={28} />} title="Chưa có thành tích" description="Chơi thêm trận custom để mở khoá." />
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {list.map((a) => {
        const Icon = ACHIEVEMENT_ICON[a.icon]
        return (
          <li key={a.id} className="flex items-start gap-4 rounded-card border border-line bg-surface/90 p-4">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-gold-tint text-gold">
              <Icon size={24} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold">{a.title}</p>
              <p className="text-sm text-fg-muted">{a.description}</p>
              <p className="mt-1 text-xs text-fg-muted tabular">{a.date}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
