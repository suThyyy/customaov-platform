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
  UserProfile,
} from '../mocks/types'

import type { Room } from '../mocks/types'

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
