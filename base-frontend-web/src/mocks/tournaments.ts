import { asset } from '../lib/asset'
import type { BracketMatch, BracketRound, ScheduledMatch, Team, Tournament, TournamentDetail, TournamentStatus } from './types'

// Mốc thời gian: xem MOCK_TODAY trong ./clock.ts (15/11/2026)

/** logoId: tái dùng logo placeholder khi đội chưa có ảnh riêng */
const team = (id: string, name: string, logoId = id): Team => ({ id, name, logo: asset(`team-${logoId}.png`) })

export const teams = {
  xanh: team('xanh', 'Team Xanh'),
  haiphong: team('haiphong', 'Hải Phòng AOV'),
  do: team('do', 'Team Đỏ'),
  shadow: team('shadow', 'Shadow Esports'),
  rongthan: team('rongthan', 'Rồng Thần'),
  aovelite: team('aovelite', 'AOV Elite'),
  nguho: team('nguho', 'Ngũ Hổ'),
  alpha: team('alpha', 'Team Alpha'),
  soidem: team('soidem', 'Sói Đêm', 'shadow'),
  phuonghoang: team('phuonghoang', 'Phượng Hoàng', 'do'),
  bachho: team('bachho', 'Bạch Hổ', 'nguho'),
  thienlong: team('thienlong', 'Thiên Long', 'rongthan'),
  kylan: team('kylan', 'Kỳ Lân', 'xanh'),
  loiho: team('loiho', 'Lôi Hổ', 'alpha'),
}

/** 8 đội của các giải đã/đang thi đấu */
const EIGHT_TEAMS = [teams.xanh, teams.haiphong, teams.do, teams.shadow, teams.rongthan, teams.aovelite, teams.nguho, teams.alpha]

/** Ngũ Kiệt Cup: 11 đội đã đăng ký / 16 chỗ */
const NGU_KIET_REGISTERED = [...EIGHT_TEAMS, teams.soidem, teams.phuonghoang, teams.bachho]
/** Đấu Trường Sinh Viên 2026: 5 / 8 chỗ */
const SINH_VIEN_REGISTERED = [teams.kylan, teams.thienlong, teams.loiho, teams.soidem, teams.phuonghoang]
/** Đại Chiến Liên Server: 4 / 16 chỗ (mới mở đăng ký hôm nay) */
const LIEN_SERVER_REGISTERED = [teams.nguho, teams.shadow, teams.thienlong, teams.bachho]
/** 8 đội của Giải Cuối Tuần #12 / Kèo Đêm Thứ Sáu #7 / Cup Mùa Thu */
const WEEKEND_TEAMS = [teams.kylan, teams.do, teams.loiho, teams.haiphong, teams.thienlong, teams.shadow, teams.soidem, teams.xanh]
const FRIDAY_TEAMS = [teams.phuonghoang, teams.nguho, teams.bachho, teams.alpha, teams.rongthan, teams.kylan, teams.aovelite, teams.loiho]
const AUTUMN_TEAMS = [teams.alpha, teams.thienlong, teams.xanh, teams.bachho, teams.shadow, teams.do, teams.nguho, teams.haiphong]

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  open: 'Đang mở đăng ký',
  live: 'Đang diễn ra',
  finished: 'Đã kết thúc',
}

/**
 * Ảnh bìa theo trạng thái: ảnh mock `tour-*.jpg` có badge in sẵn (tour-1 = mở đăng ký,
 * tour-2 = đang diễn ra, tour-3 = đã kết thúc) nên chọn ảnh khớp trạng thái.
 */
const COVER: Record<TournamentStatus, string> = {
  open: asset('tour-1.jpg'),
  live: asset('tour-2.jpg'),
  finished: asset('tour-3.jpg'),
}

/** Danh sách giải. Trạng thái khớp MOCK_TODAY (15/11/2026): mở 3 · đang diễn ra 2 · đã kết thúc 3. */
export const tournaments: Tournament[] = [
  {
    slug: 'ngu-kiet-cup-mua-1',
    name: 'Ngũ Kiệt Cup – Mùa 1',
    titleIcon: 'laurel',
    cover: COVER.open,
    status: 'open',
    format: '5v5 – Cộng đồng',
    organizer: 'CustomAOV Community',
    description:
      'Giải đấu cộng đồng 5v5 quy mô toàn server, sân chơi cho các đội custom tranh tài và khẳng định sức mạnh.',
    teamCount: 16,
    timeLabel: 'Hạn đăng ký: 20/11, 23:59',
    dateRange: '22/11 – 27/11',
    registrationDeadline: '20/11, 23:59',
    registeredTeams: NGU_KIET_REGISTERED.length,
    drawDate: '21/11',
    groupStage: 'not-started',
    createdAt: '2026-11-14',
  },
  {
    slug: 'custom-league-3',
    name: 'Custom League #3',
    titleIcon: 'trophy',
    cover: COVER.live,
    status: 'live',
    format: '5v5 – Giải giao hữu',
    organizer: 'Đấu Trường Lập Đội',
    description:
      'Series giải đấu giao hữu định kỳ, nơi các đội custom rèn luyện, cọ xát và tích lũy điểm xếp hạng cộng đồng.',
    teamCount: 8,
    timeLabel: 'Thời gian: 10/11 – 24/11',
    dateRange: '10/11 – 24/11',
    groupStage: 'finished',
    createdAt: '2026-11-05',
  },
  {
    slug: 'hoi-lang-keo-vui',
    name: 'Hội Làng Kèo Vui',
    titleIcon: 'flag',
    cover: COVER.finished,
    status: 'finished',
    format: '5v5 – Fun Cup',
    organizer: 'Cộng đồng Kèo Vui',
    description:
      'Giải đấu giải trí dành cho cộng đồng yêu custom, đề cao tinh thần vui vẻ, giao lưu và gắn kết.',
    teamCount: 8,
    timeLabel: 'Thời gian: 05/11 – 12/11',
    dateRange: '05/11 – 12/11',
    groupStage: 'finished',
    createdAt: '2026-11-01',
  },
  {
    slug: 'dai-chien-lien-server',
    name: 'Đại Chiến Liên Server',
    titleIcon: 'laurel',
    cover: COVER.open,
    status: 'open',
    format: '5v5 – Liên server',
    organizer: 'CustomAOV Community',
    description:
      'Các đội đại diện từng server so tài trong thể thức loại trực tiếp 16 đội, tìm ra server mạnh nhất mùa đông.',
    teamCount: 16,
    timeLabel: 'Hạn đăng ký: 30/11, 23:59',
    dateRange: '05/12 – 14/12',
    registrationDeadline: '30/11, 23:59',
    registeredTeams: LIEN_SERVER_REGISTERED.length,
    drawDate: '01/12',
    groupStage: 'not-started',
    createdAt: '2026-11-15',
  },
  {
    slug: 'dau-truong-sinh-vien-2026',
    name: 'Đấu Trường Sinh Viên 2026',
    titleIcon: 'trophy',
    cover: COVER.open,
    status: 'open',
    format: '5v5 – Sinh viên',
    organizer: 'CLB Esports Sinh Viên',
    description:
      'Giải đấu dành cho các đội sinh viên, thi đấu cuối tuần, giao lưu giữa các câu lạc bộ Liên Quân trường học.',
    teamCount: 8,
    timeLabel: 'Hạn đăng ký: 25/11, 23:59',
    dateRange: '28/11 – 30/11',
    registrationDeadline: '25/11, 23:59',
    registeredTeams: SINH_VIEN_REGISTERED.length,
    drawDate: '26/11',
    groupStage: 'not-started',
    createdAt: '2026-11-12',
  },
  {
    slug: 'giai-cuoi-tuan-12',
    name: 'Giải Cuối Tuần #12',
    titleIcon: 'flag',
    cover: COVER.live,
    status: 'live',
    format: '5v5 – Giao hữu cuối tuần',
    organizer: 'Đấu Trường Lập Đội',
    description:
      'Giải nhanh 3 ngày cuối tuần: tứ kết thứ Sáu, bán kết thứ Bảy, chung kết tối Chủ nhật.',
    teamCount: 8,
    timeLabel: 'Thời gian: 14/11 – 16/11',
    dateRange: '14/11 – 16/11',
    groupStage: 'finished',
    createdAt: '2026-11-08',
  },
  {
    slug: 'keo-dem-thu-sau-7',
    name: 'Kèo Đêm Thứ Sáu #7',
    titleIcon: 'flag',
    cover: COVER.finished,
    status: 'finished',
    format: '5v5 – Fun Cup',
    organizer: 'Cộng đồng Kèo Vui',
    description: 'Kèo đêm giao lưu hằng tuần, thể thức BO1 gọn nhẹ, đá xong trong 2 buổi tối.',
    teamCount: 8,
    timeLabel: 'Thời gian: 06/11 – 07/11',
    dateRange: '06/11 – 07/11',
    groupStage: 'finished',
    createdAt: '2026-10-30',
  },
  {
    slug: 'cup-mua-thu-2026',
    name: 'Cup Mùa Thu 2026',
    titleIcon: 'trophy',
    cover: COVER.finished,
    status: 'finished',
    format: '5v5 – Cộng đồng',
    organizer: 'CustomAOV Community',
    description: 'Giải cộng đồng mùa thu, tiền thân của Ngũ Kiệt Cup. Team Alpha lên ngôi sau loạt chung kết BO5.',
    teamCount: 8,
    timeLabel: 'Thời gian: 20/10 – 02/11',
    dateRange: '20/10 – 02/11',
    groupStage: 'finished',
    createdAt: '2026-10-10',
  },
]

export const findTournament = (slug: string | undefined): Tournament | undefined =>
  tournaments.find((t) => t.slug === slug)

/** Giải nổi bật hiển thị ở trang chủ (khách + người dùng) */
export const featuredTournament: Tournament = tournaments[0]

/* ---------------- Chi tiết giải (theo slug) ---------------- */

const mt = (
  id: string,
  label: string,
  time: string,
  a: Team,
  b: Team,
  score: [number, number] | null = null,
): BracketMatch => ({
  id,
  label,
  time,
  slots: [
    { team: a, score: score ? score[0] : null },
    { team: b, score: score ? score[1] : null },
  ],
})

/**
 * Nhánh loại trực tiếp 8 đội (tứ kết → bán kết → chung kết) sinh tự động.
 * `played`: số vòng đã đấu xong (2 = chờ chung kết, 3 = đã kết thúc).
 * `upsets`: chỉ số trận (0–6) mà đội thứ hai thắng — để kết quả không lặp một kiểu.
 */
function knockout(
  prefix: string,
  entrants: Team[],
  times: [string[], string[], string],
  played: 2 | 3,
  upsets: number[] = [],
  bo: [string, string, string] = ['BO3', 'BO3', 'BO5'],
): BracketRound[] {
  let idx = 0
  const play = (a: Team, b: Team, label: string, time: string, done: boolean, final = false) => {
    const i = idx++
    if (!done) return { match: mt(`${prefix}${i + 1}`, label, time, a, b), winner: a }
    const win = final ? 3 : bo[i < 4 ? 0 : 1] === 'BO1' ? 1 : 2
    const lose = final ? i % 3 : bo[i < 4 ? 0 : 1] === 'BO1' ? 0 : i % 2
    const second = upsets.includes(i)
    return {
      match: mt(`${prefix}${i + 1}`, label, time, a, b, second ? [lose, win] : [win, lose]),
      winner: second ? b : a,
    }
  }
  const qf = [0, 1, 2, 3].map((k) => play(entrants[k * 2], entrants[k * 2 + 1], `Trận ${k + 1}`, times[0][k], true))
  const sf = [0, 1].map((k) => play(qf[k * 2].winner, qf[k * 2 + 1].winner, `Trận ${k + 5}`, times[1][k], true))
  const fin = play(sf[0].winner, sf[1].winner, 'Chung kết', times[2], played === 3, true)
  return [
    { name: `Tứ kết (${bo[0]})`, matches: qf.map((x) => x.match) },
    { name: `Bán kết (${bo[1]})`, matches: sf.map((x) => x.match) },
    { name: `Chung kết (${bo[2]})`, matches: [fin.match] },
  ]
}

const DEFAULT_RULES = [
  'Mỗi đội 5 người chính + tối đa 2 dự bị, đăng ký bằng tài khoản customAOV.',
  'Thi đấu chế độ Custom 5v5, cấm/chọn theo luật giải (Draft Pick).',
  'Có mặt trong phòng trước giờ thi đấu 15 phút; trễ quá 10 phút xử thua ván.',
  'Tôn trọng đối thủ, không sử dụng phần mềm thứ ba. Vi phạm sẽ bị loại.',
]

const POINT_PRIZES = [
  { place: 'Vô địch', reward: '200 điểm xếp hạng cộng đồng' },
  { place: 'Á quân', reward: '120 điểm' },
  { place: 'Hạng ba', reward: '80 điểm' },
]

/** Phần riêng của từng giải; phần còn lại do `buildDetail` điền mặc định */
interface DetailSeed {
  title?: string
  titleAccent?: string
  intro?: string[]
  category: string
  formatLabel?: string
  teamList: Team[]
  bracket?: BracketRound[]
  /** Bỏ trống thì suy ra từ nhánh đấu (trận chưa đấu) */
  upcoming?: ScheduledMatch[]
  /** Bỏ trống thì suy ra từ nhánh đấu (trận đã đấu, mới nhất trước) */
  results?: ScheduledMatch[]
  rules?: string[]
  prizes: TournamentDetail['prizes']
}

/** Hàm tạo mẫu dùng chung cho mọi giải: ghép `Tournament` + phần riêng + mặc định. */
function buildDetail(t: Tournament, seed: DetailSeed): TournamentDetail {
  const bracket = seed.bracket ?? []
  const matches = matchesOf(bracket)
  return {
    ...t,
    title: seed.title ?? t.name,
    titleAccent: seed.titleAccent,
    intro: seed.intro ?? [t.description],
    mode: '5v5 • Custom',
    category: seed.category,
    formatLabel: seed.formatLabel ?? 'Loại trực tiếp (BO3)',
    heroImage: asset('hero-tournament.jpg'),
    teamList: seed.teamList,
    bracket,
    upcoming: seed.upcoming ?? matches.filter((m) => !m.score),
    results: seed.results ?? matches.filter((m) => m.score).reverse(),
    rules: seed.rules ?? DEFAULT_RULES,
    prizes: seed.prizes,
  }
}

const seeds: Record<string, DetailSeed> = {
  'ngu-kiet-cup-mua-1': {
    title: 'Ngũ Kiệt Cup – Mùa',
    titleAccent: '1',
    intro: [
      'Giải đấu cộng đồng 5v5 dành cho toàn thể người chơi Custom AOV.',
      'Quy tụ các đội tuyển mạnh nhất, tranh tài để tìm ra Ngũ Kiệt mùa đầu tiên!',
    ],
    category: 'Giải cộng đồng',
    teamList: NGU_KIET_REGISTERED,
    // Chưa bốc thăm: nhánh đấu và lịch công bố sau khi đóng đăng ký (bốc thăm 21/11)
    prizes: [
      { place: 'Vô địch', reward: '3.000.000đ + Cúp Ngũ Kiệt' },
      { place: 'Á quân', reward: '1.500.000đ' },
      { place: 'Hạng ba', reward: '500.000đ' },
    ],
  },
  /** Đang diễn ra: xong tứ kết + bán kết, chờ tranh hạng ba & chung kết */
  'custom-league-3': {
    title: 'Custom League',
    titleAccent: '#3',
    intro: [
      'Series giải giao hữu định kỳ của Đấu Trường Lập Đội.',
      'Vòng bảng đã khép lại — 8 đội mạnh nhất bước vào nhánh loại trực tiếp.',
    ],
    category: 'Giải giao hữu',
    teamList: EIGHT_TEAMS,
    bracket: [
      {
        name: 'Tứ kết (BO3)',
        matches: [
          mt('m1', 'Trận 1', '13/11 19:00', teams.xanh, teams.haiphong, [2, 0]),
          mt('m2', 'Trận 2', '13/11 20:30', teams.do, teams.shadow, [2, 1]),
          mt('m3', 'Trận 3', '14/11 19:00', teams.rongthan, teams.aovelite, [1, 2]),
          mt('m4', 'Trận 4', '14/11 20:30', teams.nguho, teams.alpha, [0, 2]),
        ],
      },
      {
        name: 'Bán kết (BO3)',
        matches: [
          mt('m5', 'Trận 5', '15/11 14:00', teams.xanh, teams.do, [2, 1]),
          mt('m6', 'Trận 6', '15/11 16:00', teams.aovelite, teams.alpha, [0, 2]),
        ],
      },
      {
        name: 'Chung kết (BO5)',
        matches: [mt('m7', 'Chung kết', '24/11 20:00', teams.xanh, teams.alpha)],
      },
    ],
    upcoming: [
      { id: 'u1', stage: 'Tranh hạng ba', time: '22/11 18:00', home: teams.do, away: teams.aovelite },
      { id: 'u2', stage: 'Chung kết', time: '24/11 20:00', home: teams.xanh, away: teams.alpha },
    ],
    prizes: POINT_PRIZES,
  },
  'hoi-lang-keo-vui': {
    title: 'Hội Làng',
    titleAccent: 'Kèo Vui',
    intro: [
      'Giải đấu giải trí cho cộng đồng yêu custom, đề cao tinh thần vui vẻ.',
      'Chúc mừng Ngũ Hổ đã lên ngôi vô địch!',
    ],
    category: 'Fun Cup',
    formatLabel: 'Loại trực tiếp (BO1/BO3)',
    teamList: EIGHT_TEAMS,
    bracket: [
      {
        name: 'Tứ kết (BO1)',
        matches: [
          mt('f1', 'Trận 1', '08/11 19:00', teams.nguho, teams.shadow, [1, 0]),
          mt('f2', 'Trận 2', '08/11 20:00', teams.haiphong, teams.rongthan, [0, 1]),
          mt('f3', 'Trận 3', '09/11 19:00', teams.alpha, teams.xanh, [1, 0]),
          mt('f4', 'Trận 4', '09/11 20:00', teams.do, teams.aovelite, [1, 0]),
        ],
      },
      {
        name: 'Bán kết (BO3)',
        matches: [
          mt('f5', 'Trận 5', '11/11 19:00', teams.nguho, teams.rongthan, [2, 1]),
          mt('f6', 'Trận 6', '11/11 20:30', teams.alpha, teams.do, [1, 2]),
        ],
      },
      {
        name: 'Chung kết (BO5)',
        matches: [mt('f7', 'Chung kết', '12/11 20:00', teams.nguho, teams.do, [3, 1])],
      },
    ],
    prizes: [
      { place: 'Vô địch', reward: 'Danh hiệu "Vua Kèo Vui"' },
      { place: 'Á quân', reward: 'Khung avatar giới hạn' },
    ],
  },
  'dai-chien-lien-server': {
    category: 'Giải cộng đồng',
    formatLabel: 'Loại trực tiếp 16 đội (BO3)',
    teamList: LIEN_SERVER_REGISTERED,
    prizes: [
      { place: 'Vô địch', reward: '5.000.000đ + Cúp Liên Server' },
      { place: 'Á quân', reward: '2.000.000đ' },
      { place: 'Hạng ba', reward: '1.000.000đ' },
    ],
  },
  'dau-truong-sinh-vien-2026': {
    category: 'Giải sinh viên',
    teamList: SINH_VIEN_REGISTERED,
    rules: [...DEFAULT_RULES, 'Thành viên phải là sinh viên đang theo học; ban tổ chức có thể yêu cầu xác minh.'],
    prizes: [
      { place: 'Vô địch', reward: '1.000.000đ + Học bổng CLB' },
      { place: 'Á quân', reward: '500.000đ' },
    ],
  },
  /** Đang diễn ra: xong tứ kết (14/11) + bán kết (15/11), chung kết tối 16/11 */
  'giai-cuoi-tuan-12': {
    category: 'Giải giao hữu',
    teamList: WEEKEND_TEAMS,
    bracket: knockout(
      'w',
      WEEKEND_TEAMS,
      [['14/11 19:00', '14/11 20:00', '14/11 21:00', '14/11 22:00'], ['15/11 19:00', '15/11 20:30'], '16/11 20:00'],
      2,
      [1, 5],
    ),
    prizes: POINT_PRIZES,
  },
  'keo-dem-thu-sau-7': {
    category: 'Fun Cup',
    formatLabel: 'Loại trực tiếp (BO1/BO3)',
    teamList: FRIDAY_TEAMS,
    bracket: knockout(
      'k',
      FRIDAY_TEAMS,
      [['06/11 19:00', '06/11 19:45', '06/11 20:30', '06/11 21:15'], ['07/11 19:00', '07/11 20:30'], '07/11 22:00'],
      3,
      [0, 2, 6],
      ['BO1', 'BO3', 'BO5'],
    ),
    prizes: [{ place: 'Vô địch', reward: 'Danh hiệu "Cú Đêm"' }],
  },
  'cup-mua-thu-2026': {
    category: 'Giải cộng đồng',
    teamList: AUTUMN_TEAMS,
    bracket: knockout(
      'c',
      AUTUMN_TEAMS,
      [['25/10 19:00', '25/10 20:30', '26/10 19:00', '26/10 20:30'], ['01/11 19:00', '01/11 20:30'], '02/11 20:00'],
      3,
      [3],
    ),
    prizes: [
      { place: 'Vô địch', reward: '2.000.000đ' },
      { place: 'Á quân', reward: '1.000.000đ' },
      { place: 'Hạng ba', reward: '500.000đ' },
    ],
  },
}

export const getTournamentDetail = (slug: string | undefined): TournamentDetail | undefined => {
  const t = findTournament(slug)
  const s = t && seeds[t.slug]
  return t && s ? buildDetail(t, s) : undefined
}

/** Trận trong nhánh đấu, theo thứ tự vòng (tứ kết → chung kết) */
function matchesOf(bracket: BracketRound[]): ScheduledMatch[] {
  return bracket.flatMap((round) =>
    round.matches.map((m) => {
      const [a, b] = m.slots
      const roundName = round.name.replace(/\s*\(.*\)/, '')
      return {
        id: m.id,
        // "Chung kết · Chung kết" → "Chung kết"
        stage: m.label === roundName ? roundName : `${roundName} · ${m.label}`,
        time: m.time,
        home: a.team,
        away: b.team,
        score: a.score !== null && b.score !== null ? ([a.score, b.score] as [number, number]) : undefined,
      }
    }),
  )
}

/** Toàn bộ trận (cho tab Lịch thi đấu) — lấy từ nhánh đấu */
export const allMatches = (d: TournamentDetail): ScheduledMatch[] => matchesOf(d.bracket)
