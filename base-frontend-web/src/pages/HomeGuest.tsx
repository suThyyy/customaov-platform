import { useCallback, useRef, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Box,
  Check,
  Gamepad2,
  Scale,
  Shuffle,
  SquarePlus,
  Swords,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { asset } from '../lib/asset'
import { cn } from '../lib/cn'
import { useAuth } from '../context/AppContext'
import { communityStats, roomsAdapter, tournamentsAdapter, useRooms, useTournaments, type RoomMember } from '../api'
import { SkipLink } from '../components/layout/AppShell'
import { BottomNav } from '../components/layout/BottomNav'
import { Container } from '../components/layout/Container'
import { Footer } from '../components/layout/Footer'
import { TopNav } from '../components/layout/TopNav'
import { loginHref } from '../components/layout/nav'
import { useRouteScroll } from '../components/layout/hooks'
import { ButtonLink } from '../components/ui/Button'
import { Avatar, Card, Eyebrow, SeeAllLink } from '../components/ui/primitives'
import { FeatureCard } from '../components/domain/FeatureCard'
import { RoomCard } from '../components/domain/RoomsTable'
import { EmptyState } from '../components/domain/EmptyState'
import { ListStatus, SkeletonRows } from '../components/ui/ListStatus'
import { TournamentPromoCard } from '../components/domain/TournamentPromoCard'
import { LoginModal, type LoginIntent } from '../components/LoginModal'
import { SampleDataBadge } from '../components/ui/SampleDataBadge'

const INTENTS: LoginIntent[] = ['login', 'register', 'start']

const STEPS = [
  {
    icon: SquarePlus,
    title: 'Tạo phòng & mời bạn',
    description: 'Đặt tên phòng, chọn chế độ Căng / Vui / Custom và gửi mã phòng cho bạn bè.',
  },
  {
    icon: Scale,
    title: 'Chia đội công bằng',
    description: 'Hệ thống cân bằng trình độ hai đội, random lane hoặc tướng chỉ với một chạm.',
  },
  {
    icon: Swords,
    title: 'Vào trận & lưu kết quả',
    description: 'Xuất đội hình sang game, ghi kết quả và theo dõi thành tích trên hồ sơ.',
  },
]

/** Section bọc chung: tiêu đề + mô tả + nội dung, cách nhau 48px */
function Section({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  id?: string
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const titleId = id ? `${id}-title` : undefined
  return (
    <section id={id} aria-labelledby={titleId} className={cn('mt-16', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 id={titleId} className="mt-2 font-display text-2xl font-bold">
            {title}
          </h2>
          {description && <p className="mt-2 max-w-[65ch] text-base text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export default function HomeGuest() {
  const { loggedIn } = useAuth()
  const navigate = useNavigate()
  const roomLoad = useRooms()
  const tournamentLoad = useTournaments()
  const rooms = roomLoad.data
  const featuredTournament = tournamentLoad.data[0]
  const mainRef = useRef<HTMLElement>(null)
  useRouteScroll(mainRef)

  // Hộp đăng nhập điều khiển bằng query `?login=<intent>&next=<path>` để TopNav/BottomNav/Footer ở mọi trang mở được
  const [params, setParams] = useSearchParams()
  const rawIntent = params.get('login')
  // `?login=1` là dạng rút gọn của `?login=login`
  const intent: LoginIntent | null =
    rawIntent === '1' ? 'login' : INTENTS.includes(rawIntent as LoginIntent) ? (rawIntent as LoginIntent) : null
  const next = params.get('next') ?? '/dashboard'
  const closeModal = useCallback(() => setParams({}, { replace: true }), [setParams])

  // Đã đăng nhập (kể cả ngay sau khi bấm "Vào bằng tài khoản mẫu") → về trang `next`
  if (loggedIn) return <Navigate to={next} replace />

  // 3 phòng đang chờ, ưu tiên phòng còn nhiều chỗ — bằng chứng cộng đồng đang hoạt động
  const openRooms = rooms
    .filter((r) => r.status === 'waiting')
    .sort((a, b) => b.capacity - b.playerCount - (a.capacity - a.playerCount))
    .slice(0, 3)
  const goRoom = (id: string) => navigate(loginHref('login', `/rooms/${id}`))

  return (
    <div className="pb-bottom-nav relative isolate flex min-h-dvh flex-col overflow-x-clip bg-bg">
      {/* Nền: tranh nhân vật góc phải trên + ánh vàng (placeholder cắt từ mock) */}
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[400px]">
        <img
          src={asset('hero-valhein.jpg')}
          alt=""
          // < 1024px ảnh nằm sau chữ hero → giảm độ đậm để giữ tương phản AA (Phase 5: đo điểm ảnh ở 768 trước đó chỉ 2.7:1)
          className="absolute top-0 right-0 h-full w-[52%] object-cover object-left-top max-lg:opacity-30"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-bg)_0%,var(--color-bg)_44%,rgb(13_15_19/0.4)_56%,transparent_72%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,var(--color-bg),transparent)]" />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[radial-gradient(60%_50%_at_0%_100%,rgb(242_150_70/0.12),transparent_70%),radial-gradient(40%_40%_at_100%_100%,rgb(242_180_99/0.06),transparent_70%)]"
      />

      <SkipLink />
      <TopNav />

      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <Container>
          {/* Hero — nút vàng đặc của khung nhìn đầu: "Bắt đầu ngay" (CTA cuối trang là nút vàng thứ hai, ở khung nhìn khác) */}
          <section className="pt-8 md:pt-12" aria-labelledby="hero-title">
            <Eyebrow className="text-sm">Custom AOV Community</Eyebrow>
            <h1 id="hero-title" className="mt-2 font-display text-4xl leading-tight font-bold tracking-[-0.01em]">
              Nền tảng hỗ trợ chơi
              <br className="hidden sm:block" /> Custom <span className="text-gold-gradient">Liên Quân</span> cùng cộng
              đồng
            </h1>
            <p className="mt-4 max-w-[56ch] text-lg text-fg/90">
              Tạo phòng, lập đội, chia team công bằng, random lane/tướng và tham gia các giải đấu cộng đồng dành cho
              người chơi Liên Quân.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink
                to={loginHref('start')}
                pill
                size="lg"
                className="px-8"
                rightIcon={<ArrowRight size={20} aria-hidden />}
              >
                Bắt đầu ngay
              </ButtonLink>
              <ButtonLink to="/#how-it-works" pill size="lg" variant="outline" className="px-8">
                Tìm hiểu thêm
              </ButtonLink>
            </div>
          </section>

          {/* Tính năng */}
          <section id="features" aria-label="Tính năng nổi bật" className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
            <FeatureCard
              icon={<SquarePlus strokeWidth={1.6} />}
              title="Tạo phòng nhanh"
              description="Lập phòng custom linh hoạt, thiết lập theo ý muốn."
              to={loginHref('start', '/rooms/new')}
            />
            <FeatureCard
              icon={<Scale strokeWidth={1.6} />}
              title="Chia đội công bằng"
              description="Cân bằng trình độ, xếp đội hợp lý cho trận đấu hấp dẫn."
              to="/#preview"
            />
            <FeatureCard
              icon={<Box strokeWidth={1.6} />}
              title="Random lane / tướng"
              description="Phân vị trí hoặc tướng ngẫu nhiên, đa dạng và công bằng."
              to="/#preview"
            />
            <FeatureCard
              icon={<Trophy strokeWidth={1.6} />}
              title="Giải đấu cộng đồng"
              description="Tham gia các giải đấu custom được tổ chức thường xuyên."
              to="/tournaments"
            />
          </section>

          {/* Cách hoạt động */}
          <Section
            id="how-it-works"
            eyebrow="Cách hoạt động"
            title="Lập kèo custom trong 3 bước"
            description="Không cần bảng tính hay chia đội bằng tay — mọi thứ nằm trong một phòng."
          >
            <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface/85 p-6">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-tint font-display text-base font-bold text-gold ring-1 ring-gold/40"
                    >
                      {i + 1}
                    </span>
                    <s.icon size={24} aria-hidden className="text-gold" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    <span className="sr-only">Bước {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="text-sm text-fg-muted">{s.description}</p>
                </li>
              ))}
            </ol>
          </Section>

          {/* Ảnh chụp tính năng: dựng bằng component thật + mock data (không phải ảnh tĩnh) */}
          <Section
            id="preview"
            eyebrow="Xem trước"
            title="Chia đội công bằng, nhìn là hiểu"
            description="Hai đội được cân bằng theo trình độ, mỗi người một lane. Không ưng thì chia lại hoặc đổi chỗ thủ công."
            action={<SampleDataBadge show={roomsAdapter.showsSampleBadge} />}
          >
            {rooms[0] && <TeamSplitPreview blue={rooms[0].teams.blue} red={rooms[0].teams.red} />}
          </Section>

          {/* Phòng đang mở */}
          <Section
            id="rooms"
            eyebrow="Đang hoạt động"
            title="Phòng đang mở"
            description="Một vài phòng custom đang chờ người chơi. Đăng nhập để vào phòng."
            action={<span className="flex flex-wrap items-center gap-3"><SampleDataBadge show={roomsAdapter.showsSampleBadge} /><SeeAllLink to={loginHref('login', '/dashboard#rooms')}>Xem tất cả phòng</SeeAllLink></span>}
          >
            <ListStatus
              status={roomLoad.status}
              onRetry={roomLoad.retry}
              label="phòng đang mở"
              skeleton={<SkeletonRows count={3} className="rounded-card border border-line bg-surface/90 px-4" />}
            >
              {openRooms.length === 0 ? (
                <EmptyState
                  icon={<Gamepad2 size={28} />}
                  title="Chưa có phòng nào đang chờ"
                  description="Tạo tài khoản và mở phòng đầu tiên cho cộng đồng."
                />
              ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {openRooms.map((r) => (
                    <RoomCard key={r.id} room={r} onJoin={() => goRoom(r.id)} onWatch={() => goRoom(r.id)} />
                  ))}
                </ul>
              )}
            </ListStatus>
          </Section>

          {/* Cộng đồng: con số + giải nổi bật */}
          <Section id="community" eyebrow="Cộng đồng" title="Cộng đồng Custom Liên Quân" action={<SampleDataBadge show={tournamentsAdapter.showsSampleBadge} />}>
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="flex min-w-0 flex-col gap-6">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {communityStats.map((s) => (
                    <Card key={s.label} className="flex flex-col gap-2 p-6">
                      <dt className="text-sm text-fg-muted">{s.label}</dt>
                      <dd className="text-stat text-gold-gradient">{s.value}</dd>
                    </Card>
                  ))}
                </dl>
                <Card className="flex flex-col gap-3 p-6">
                  <p className="flex items-center gap-2 text-lg font-semibold">
                    <UsersRound size={20} aria-hidden className="text-gold" />
                    Tham gia cùng mọi người
                  </p>
                  <p className="max-w-[60ch] text-sm text-fg-muted">
                    Theo dõi các giải đấu do cộng đồng tổ chức, tìm đồng đội mới và chia sẻ khoảnh khắc từ những kèo
                    custom.
                  </p>
                  <div>
                    <SeeAllLink to="/tournaments">Xem các giải đấu</SeeAllLink>
                  </div>
                </Card>
              </div>
              {/* Nút "Đăng ký ngay" dùng viền vàng: nút vàng đặc của trang là "Bắt đầu ngay" ở hero */}
              {featuredTournament && (
                <TournamentPromoCard
                  size="lg"
                  ctaVariant="gold-outline"
                  tournament={featuredTournament}
                  onOpen={() => navigate(`/tournaments/${featuredTournament.slug}`)}
                  onRegister={() => navigate(loginHref('register', `/tournaments/${featuredTournament.slug}`))}
                />
              )}
            </div>
          </Section>

          {/* CTA cuối trang — vàng đặc (trang dài: được có CTA vàng ở hero và cuối trang, xem UI_REFACTOR_RULES) */}
          <section
            aria-labelledby="cta-title"
            className="mt-16 overflow-hidden rounded-card border border-gold/30 bg-[radial-gradient(80%_120%_at_100%_0%,rgb(242_180_99/0.18),transparent_60%)] bg-surface p-8 md:p-12"
          >
            <h2 id="cta-title" className="font-display text-2xl font-bold">
              Sẵn sàng lập kèo custom đầu tiên?
            </h2>
            <p className="mt-2 max-w-[56ch] text-base text-fg-muted">
              Tạo tài khoản miễn phí, mở phòng và mời bạn bè — chia đội công bằng chỉ mất vài giây.
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg/90">
              {['Miễn phí', 'Không cần cài đặt', 'Đăng nhập bằng tài khoản mẫu để thử'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check size={16} aria-hidden className="text-gold" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink
                to={loginHref('register')}
                size="lg"
                variant="primary"
                rightIcon={<ArrowRight size={18} aria-hidden />}
              >
                Tạo tài khoản
              </ButtonLink>
              <ButtonLink to={loginHref('login')} size="lg" variant="ghost">
                Đã có tài khoản? Đăng nhập
              </ButtonLink>
            </div>
          </section>
        </Container>
      </main>

      <Footer />
      <BottomNav />
      <LoginModal intent={intent} redirectTo={next} onClose={closeModal} />
    </div>
  )
}

/** Bản xem trước màn chia đội (tĩnh, chỉ để minh hoạ) */
function TeamSplitPreview({ blue, red }: { blue: RoomMember[]; red: RoomMember[] }) {
  return (
    <Card className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Gamepad2 size={20} aria-hidden className="text-gold" />
          Kèo giao hữu – Team A vs B
        </p>
        <p className="flex flex-wrap items-center gap-3 text-sm text-fg-muted">
          <span className="flex items-center gap-2">
            <Scale size={16} aria-hidden className="text-success" />
            Chênh lệch trình độ: <span className="font-semibold text-success">thấp</span>
          </span>
          <span className="flex items-center gap-2">
            <Shuffle size={16} aria-hidden />
            Lane: ngẫu nhiên
          </span>
        </p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <PreviewTeam name="Team Xanh" tone="blue" members={blue} />
        <PreviewTeam name="Team Đỏ" tone="red" members={red} />
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          to={loginHref('start', '/rooms/AOV-1024')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:text-gold-300"
        >
          Thử chia đội <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </Card>
  )
}

function PreviewTeam({ name, tone, members }: { name: string; tone: 'blue' | 'red'; members: RoomMember[] }) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-btn border',
        tone === 'blue' ? 'border-team-blue/40 bg-team-blue-body' : 'border-team-red/40 bg-team-red-body',
      )}
    >
      <p
        className={cn(
          'px-4 py-2 text-sm font-semibold',
          tone === 'blue' ? 'bg-team-blue-bg text-team-blue-fg' : 'bg-team-red-bg text-team-red-fg',
        )}
      >
        {name}
      </p>
      <ul className="flex flex-col">
        {members.map((m, i) => (
          <li key={m.player.id} className={cn('flex items-center gap-3 px-4 py-2', i > 0 && 'border-t border-line')}>
            <Avatar src={m.player.avatar} name={m.player.name} alt="" size={32} />
            <span className="min-w-0 flex-1 text-sm font-medium">{m.player.name}</span>
            <span className="rounded-chip bg-lane-chip px-2 py-1 text-xs font-semibold text-fg-muted">{m.lane}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
