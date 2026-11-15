export type Lane = 'TOP' | 'JG' | 'MID' | 'AD' | 'SP'

export interface Player {
  id: string
  name: string
  avatar: string
  level?: number
  /** Hiển thị vương miện cạnh tên (chủ phòng / VIP) */
  crowned?: boolean
  /**
   * Mâm/Tier dùng cho chia đội mode `tier` (key trong bảng điểm, vd. 1–5 của
   * DEFAULT_TIER_SCORES). Mock hiện CHƯA có dữ liệu này — không tự gán.
   */
  tier?: string | number
  /**
   * Hạng Rank dùng cho chia đội mode `rank` (key trong bảng điểm Rank do caller
   * cung cấp). Không phải MMR. Mock hiện CHƯA có dữ liệu này — không tự gán.
   */
  rankTier?: string | number
}

export type RoomStatus = 'waiting' | 'live'
export type RoomVisibility = 'public' | 'private'

export interface RoomMember {
  player: Player
  lane: Lane
  ready: boolean
  captain?: boolean
}

export interface Room {
  id: string // AOV-1024
  title: string
  /** Phần tiêu đề tô vàng trên banner phòng (phần sau dấu gạch) */
  highlight?: string
  thumbnail: string
  host: Player
  modeLabel: string // "5v5 · Custom"
  visibility: RoomVisibility
  playerCount: number
  capacity: number
  status: RoomStatus
  teams: { blue: RoomMember[]; red: RoomMember[] }
}

export type TournamentStatus = 'open' | 'live' | 'finished'
export type StageStatus = 'not-started' | 'live' | 'finished'

export interface Tournament {
  slug: string
  name: string
  titleIcon: 'laurel' | 'trophy' | 'flag'
  cover: string
  status: TournamentStatus
  format: string // "5v5 – Cộng đồng"
  organizer: string
  description: string
  teamCount: number
  /** Dòng thời gian: "Hạn đăng ký: 20/11, 23:59" hoặc "Thời gian: 10/11 – 24/11" */
  timeLabel: string
  /** Khoảng thời gian thi đấu, vd "22/11 – 27/11" */
  dateRange: string
  /** Hạn đăng ký (chỉ khi status = 'open'), vd "20/11, 23:59" */
  registrationDeadline?: string
  /** Số đội đã đăng ký (chỉ khi status = 'open'); tổng chỗ = teamCount */
  registeredTeams?: number
  /** Ngày bốc thăm nhánh đấu (chỉ khi status = 'open'), vd "21/11" */
  drawDate?: string
  groupStage: StageStatus
  createdAt: string // ISO, cho sắp xếp
}

/** Dữ liệu trang chi tiết giải — tra theo slug (xem getTournamentDetail) */
export interface TournamentDetail extends Tournament {
  /** Phần tiêu đề thường + phần tô vàng trên banner */
  title: string
  titleAccent?: string
  intro: string[]
  mode: string // "5v5 • Custom"
  category: string // "Giải cộng đồng"
  formatLabel: string // "Loại trực tiếp (BO3)"
  heroImage: string
  /** Các đội đã đăng ký / tham gia (tab Danh sách đội) */
  teamList: Team[]
  bracket: BracketRound[]
  upcoming: ScheduledMatch[]
  results: ScheduledMatch[]
  rules: string[]
  prizes: Array<{ place: string; reward: string }>
}

export interface ChatMessage {
  id: string
  author: Player
  text: string
  time: string // "19:02"
  /** Tin hệ thống (vào phòng, chia đội…) */
  system?: boolean
}

export interface HomeSlide {
  lead: string
  line2: string
  accent: string
  desc: [string, string]
}

export interface Team {
  id: string
  name: string
  logo: string
}

export interface BracketSlot {
  team: Team
  score: number | null
}

export interface BracketMatch {
  id: string
  label: string // "Trận 1"
  time: string // "20/11 19:00"
  slots: [BracketSlot, BracketSlot]
}

export interface BracketRound {
  name: string // "Tứ kết (BO3)"
  matches: BracketMatch[]
}

export interface ScheduledMatch {
  id: string
  stage: string // "Bán kết · Trận 6"
  time: string
  home: Team
  away: Team
  score?: [number, number]
}

export interface ChampionStat {
  name: string
  image: string
  avatar?: string
  matches: number
  winRate: number
}

export interface RoleStat {
  role: string
  icon: 'ad' | 'mage' | 'jungle' | 'mid' | 'tank'
  percent: number
}

export interface MatchHistoryItem {
  id: string
  mode: string
  roomName: string
  champion: { name: string; avatar: string }
  result: 'win' | 'loss'
  kda: [number, number, number]
  kdaRatio: number
  items: string[]
  timeAgo: string
}

export interface Achievement {
  id: string
  title: string
  description: string
  date: string // "12/11/2026"
  icon: 'trophy' | 'star' | 'swords' | 'users'
}

export interface UserProfile {
  player: Player
  /** Tên định danh công khai, vd "@suthy" (không dùng dạng #AOV-… vì trùng mã phòng) */
  publicId: string
  /** Mã số người dùng, vd "102394" */
  uid: string
  achievements: Achievement[]
  roleBadge: string
  playerBadge: string
  bio: string
  bioExtra: string
  stats: { totalMatches: number; winRate: number; customMatches: number; mvp: number }
  champions: ChampionStat[]
  roles: RoleStat[]
  history: MatchHistoryItem[]
}

export type ActivityKind = 'join' | 'register' | 'invite' | 'result'

export interface Activity {
  id: string
  kind: ActivityKind
  text: string
  /** Phần được tô màu (vd: "Thắng") */
  emphasis?: string
  timeAgo: string
}
