export type {
  Achievement,
  Activity,
  ActivityKind,
  ChampionStat,
  ChatMessage,
  Lane,
  MatchHistoryItem,
  Player,
  RoleStat,
  RoomMember,
  RoomStatus,
  RoomVisibility,
  ScheduledMatch,
  StageStatus,
  Team,
  Tournament,
  TournamentStatus,
} from '../mocks/types'

import type { Registration, RoomMode, Series, TournamentDetail as ApiTournamentDetail } from '@customaov/contracts'
import { PLAY_STYLE_SHORT_LABEL } from './roomConfig'
import type {
  BracketMatch as MockBracketMatch,
  BracketSlot as MockBracketSlot,
  Room as MockRoom,
  Team,
  TournamentDetail as MockTournamentDetail,
  UserProfile as MockUserProfile,
} from '../mocks/types'

export type { Registration }

/**
 * Slot nhánh đấu. Nguồn API có slot chưa có đội (API.md 9.3): `map.ts` thay bằng đội giữ chỗ
 * và đánh dấu `placeholder` để UI hiện "BYE" / "Chưa xác định" thay vì tên đội.
 */
export interface BracketSlot extends MockBracketSlot {
  placeholder?: 'bye' | 'tbd'
}

export interface BracketMatch extends Omit<MockBracketMatch, 'slots'> {
  slots: [BracketSlot, BracketSlot]
}

export interface BracketRound {
  name: string
  matches: BracketMatch[]
}

export type TournamentRole = 'organizer' | 'captain' | 'member'

/** Chi tiết giải. Các field tuỳ chọn chỉ có ở nguồn API (mock không có BTC / đăng ký thật). */
export interface TournamentDetail extends Omit<MockTournamentDetail, 'bracket'> {
  bracket: BracketRound[]
  /** Nhà vô địch do backend suy ra; mock tiếp tục suy từ nhánh đấu. */
  champion?: Team | null
  series?: Series
  myRole?: ApiTournamentDetail['myRole']
  myRegistration?: Registration | null
  /** Hạn đăng ký dạng ISO (để biết BTC đã đóng đăng ký hay chưa) */
  registrationDeadlineAt?: string
}

/** Nhãn thời gian của trận chưa có giờ (API.md 9.3) */
export const UNSCHEDULED_LABEL = 'Chưa xếp lịch'

export interface ProfileRecordHistoryItem {
  id: string
  roomCode: string
  roomName: string
  result: 'win' | 'loss'
  timeAgo: string
}

export type UserProfile = Omit<MockUserProfile, 'stats'> & {
  stats: MockUserProfile['stats'] & {
    wins?: number
    losses?: number
    tournamentsJoined?: number
    titles?: number
  }
  /** Chỉ có ở nguồn API; dữ liệu này không phụ thuộc telemetry trong game. */
  recordHistory?: ProfileRecordHistoryItem[]
  /** API MVP không có dữ liệu tướng, KDA, vai trò hoặc trang bị. */
  hasGameData?: boolean
}

/**
 * Phòng ở UI. `isMember` chỉ có ở chế độ api (`RoomSummary.isMember`): danh sách phòng của server
 * không kèm đội, nên không suy ra thành viên từ `teams` được.
 */
export type Room = MockRoom & { isMember?: boolean }

/** Nhãn phong cách ngắn thay cho nhãn mode của wizard cũ. */
export const ROOM_MODE_SHORT_LABEL: Record<RoomMode, string> = {
  normal: PLAY_STYLE_SHORT_LABEL.tryhard,
  tournament: PLAY_STYLE_SHORT_LABEL.tryhard,
  friendly: PLAY_STYLE_SHORT_LABEL.fun,
  other: PLAY_STYLE_SHORT_LABEL.tryhard,
}

export const roomFullTitle = (room: Pick<Room, 'title' | 'highlight'>): string =>
  room.highlight ? `${room.title} – ${room.highlight}` : room.title

export type LoadStatus = 'loading' | 'error' | 'ready'

export interface ResourceState<T> {
  status: LoadStatus
  data: T
  error?: Error
  retry: () => void
}

export const TOURNAMENT_STATUS_LABEL: Record<import('../mocks/types').TournamentStatus, string> = {
  open: 'Đang mở đăng ký',
  live: 'Đang diễn ra',
  finished: 'Đã kết thúc',
}
