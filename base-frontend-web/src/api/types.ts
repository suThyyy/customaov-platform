export type {
  Achievement,
  Activity,
  ActivityKind,
  BracketMatch,
  BracketRound,
  BracketSlot,
  ChampionStat,
  ChatMessage,
  Lane,
  MatchHistoryItem,
  Player,
  RoleStat,
  Room,
  RoomMember,
  RoomStatus,
  RoomVisibility,
  ScheduledMatch,
  StageStatus,
  Team,
  Tournament,
  TournamentStatus,
  UserProfile,
} from '../mocks/types'

import type { Registration, TournamentDetail as ApiTournamentDetail } from '@customaov/contracts'
import type { Room, TournamentDetail as MockTournamentDetail } from '../mocks/types'

export type { Registration }

/**
 * Chi tiết giải dùng ở UI. `myRole`/`myRegistration` chỉ có ở chế độ api (mock không có đăng ký thật).
 */
export interface TournamentDetail extends MockTournamentDetail {
  myRole?: ApiTournamentDetail['myRole']
  myRegistration?: Registration | null
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
