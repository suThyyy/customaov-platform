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
  TournamentDetail,
  TournamentStatus,
} from '../mocks/types'

import type { Room, UserProfile as MockUserProfile } from '../mocks/types'

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
